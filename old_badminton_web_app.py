import streamlit as st            # Tech: Main UI framework and state manager. Func: Handles the web interface, buttons, and session data.
import random                   # Tech: Pseudo-random number generator. Func: Shuffles player splits and breaks ties in fairness sorting.
import string                   # Tech: String constants library. Func: Provides character sets used to generate unique alphanumeric session IDs.
from collections import defaultdict # Tech: Dict subclass with automatic key initialization. Func: Tracks player game history without 'KeyError' crashes.
from itertools import combinations # Tech: Combinatorial generator. Func: Calculates every possible 4-player group from the roster for match evaluation.
import pandas as pd              # Tech: High-performance data analysis library. Func: Manages the match tables, player lists, and data sorting.
from google.cloud import firestore # Tech: NoSQL Cloud Database client. Func: Connects the app to the backend for live sharing and data persistence.
from datetime import datetime, timedelta # Tech: Time manipulation tools. Func: Manages localized GMT+8 timestamps for "Last Refreshed" status.
import altair as alt              # Tech: Declarative statistical visualization. Func: Generates the integer-based bar charts for session statistics.

# -------------------------------------------------
# Section 1. PAGE CONFIGURATION & SECURITY
# -------------------------------------------------
# Tech: st.set_page_config is a singleton that must be initialized before any other Streamlit command.
# Func: Optimizes screen real estate for data-heavy match tables and sets the browser tab title.
st.set_page_config(page_title="Badminton Game Schedule", layout="wide")


query_params = st.query_params
is_admin = st.session_state.get("is_admin", False)
is_host_attempt = "host" in query_params

# Tech: CSS injection via st.markdown with unsafe_allow_html=True. 
# Func: Customizes button widths, code block colors, and professional developer credits styling.
st.markdown("""
                <style>
                    .match-container {
                        position: relative;
                        padding: 20px;
                        border-radius: 10px;
                        overflow: hidden;
                        margin-bottom: 15px;
                        border: 1px solid #333;
                    }

                    .status-bg {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        z-index: 1;
                        opacity: 0.; /* Tint strength */
                    }

                    .match-content {
                        position: relative;
                        z-index: 2;
                        color: white;
                    }

                    /* Standardized Status Colors */
                    .bg-waiting { background-color: #B5B5B5; } /* Gray */
                    .bg-next    { background-color: #e69138; } /* Orange */
                    .bg-playing { background-color: #00E60E; } /* Green */
                    .bg-end     { background-color: #990000; } /* Red */
                </style>
                <meta property="og:image" content="https://github.com/wes-teros14/public_assets/blob/main/rabbitsmash.jpg">
                """, unsafe_allow_html=True)



# Tech: Handling RSA key formatting for secure Google Cloud SDK authentication via Streamlit Secrets.
# Func: Connects the app to Google Cloud Firestore (the database).
# Variables: 'creds_dict' holds sensitive DB keys. 'st.session_state.db' caches the client to avoid redundant handshakes.
if "db" not in st.session_state:
    try:
        creds_dict = dict(st.secrets["firestore"])
        creds_dict["private_key"] = creds_dict["private_key"].replace("\\n", "\n")
        st.session_state.db = firestore.Client.from_service_account_info(creds_dict)
    except Exception as e:
        st.error(f"Firestore Initialization Error: {e}")

# -------------------------------------------------
# Section 2. UTILITIES: RANDOM ID & TIME
# -------------------------------------------------

# Tech: Firestore .set() call. Func: Commits the newly generated match schedule to the cloud database.
def push_callback():
    if st.session_state.get("db"):
        curr_id = st.session_state.auto_session_id
        host_key = st.session_state.last_push_links["host_key"] if "last_push_links" in st.session_state else generate_random_id(6)
        session_data = {"matches": st.session_state.last_matches, "player_list": current_players_input.to_dict('records'), "stats": st.session_state.last_stats, "updated_at": datetime.utcnow()}
        st.session_state.db.collection("sessions").document(curr_id).set(session_data)
        st.session_state.last_push_links = {"session": curr_id, "host_key": host_key}
        st.query_params.update(session=curr_id, host=host_key)


def evaluate_session_score(matches, wishlist_str, streak_limit, p_streak_weight, p_imbalance, r_wishlist, p_repeat_partner, p_fairness_weight, p_spread_penalty, max_spread_limit):
    # Tech: Final Heuristic. 
    # Func: Grades session on 5 factors: Participation, Rest, Partners, Wishes, and Skill Balance.
    score = 10000 
    
    audit_data = {
        "Streak Violations": 0,
        "Repeat Partners": 0,
        "Wishes Granted": 0,
        "Level Gaps": 0.0,
        "Participation Gap": 0,
        "Wide Gaps": 0
    }
    
    df = pd.DataFrame(matches).sort_values('Game')
    partner_counts = defaultdict(int)
    individual_game_counts = defaultdict(int) 
    player_streaks = defaultdict(int)

    # 1. Parsing Wishlist
    target_pairs = []
    if wishlist_str:
        for pair in wishlist_str.split(','):
            names = [n.strip() for n in pair.split('-')]
            if len(names) == 2:
                target_pairs.append(set(names))
    
    for i, row in df.iterrows():
        t1_names = [n.strip() for n in str(row['Team 1']).split('&')]
        t2_names = [n.strip() for n in str(row['Team 2']).split('&')]
        t1_set, t2_set = set(t1_names), set(t2_names)
        current_players = t1_set.union(t2_set)

        # --- REFINED INTEGER SPREAD CHECK ---
        p_levels = row.get('Player Levels', [])
        if p_levels:
             clean_levels = [round(lvl) for lvl in p_levels]
             match_spread = max(clean_levels) - min(clean_levels)
             limit = round(max_spread_limit)
            
             # 3. STRICT COMPARISON
             # If spread is 2 and limit is 2, (2 > 2) is FALSE. No violation.
             if match_spread > limit:
                 score -= p_spread_penalty
                 audit_data["Wide Gaps"] += 1

        # Track individual participation
        for p in current_players:
            individual_game_counts[p] += 1

        # 2. PENALTY: Consecutive Games (Fatigue)
        for p in current_players:
            player_streaks[p] += 1
            if player_streaks[p] > streak_limit:
                score -= p_streak_weight
                audit_data["Streak Violations"] += 1
        
        # Reset streak for resting players
        for p in list(player_streaks.keys()):
            if p not in current_players:
                player_streaks[p] = 0

        # 3. PENALTY: Repeat Partners (Variety)
        for team in [t1_names, t2_names]:
            if len(team) == 2:
                pair = tuple(sorted(team))
                partner_counts[pair] += 1
                if partner_counts[pair] > 1:
                    score -= p_repeat_partner
                    audit_data["Repeat Partners"] += 1

        # 4. REWARD: Partner Wishlist
        for target in target_pairs:
            if target.issubset(t1_set) or target.issubset(t2_set):
                score += r_wishlist
                audit_data["Wishes Granted"] += 1

        # 5. PENALTY: Level Imbalance (Competition)
        diff = abs(row['T1 Level'] - row['T2 Level'])
        score -= (diff * p_imbalance)
        audit_data["Level Gaps"] += diff
        
    # --- THE FAIRNESS HAMMER ---
    if individual_game_counts:
        counts = list(individual_game_counts.values())
        gap = max(counts) - min(counts)
        audit_data["Participation Gap"] = gap
        score -= (gap * p_fairness_weight)
        
    return score, audit_data
def generate_random_id(length=6):
    # Tech: Alphanumeric string generation using random.choice.
    # Func: Generates unique session/host keys for URL-based sharing and session recovery.
    return ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(length))

def get_gmt8_time():
    # Tech: UTC offset logic using timedelta. 
    # Func: Provides localized timestamps for the Philippines region (GMT+8).
    return datetime.utcnow() + timedelta(hours=8)

# -------------------------------------------------
# Section 3. THE MATCH GENERATION ENGINE
# -------------------------------------------------
def generate_matches(players_list, num_matches_requested, avoid_repeat_partners, streak_limit, prioritize_gender_doubles, disable_gender_rules, max_spread_limit):
    """
    ENGINE FLOW:
    A. SORT: Prioritize players who have played the least (Fairness).
    B. SELECTION: Pick a potential group of 4 players using combinations.
    C. CATEGORIZATION: Identify as Mixed, MD, WD, or Doubles.
    D. DYNAMIC GAP OPTIMIZATION: Calculate all 3 possible splits and choose the best level balance.
    E. RELAXATION: If no match passes, lower heuristic standards and try again.
    
    Variables:
    - gender_map/level_map: Dicts for $O(1)$ attribute lookup.
    - games_played_count: Int tracker ensuring even court time distribution.
    - teammate_pairing_history: Set of sorted tuples to ensure partner variety.
    """
    player_names = [player["name"] for player in players_list if player.get("name")]
    gender_map = {player["name"]: player["gender"] for player in players_list if player.get("name")}
    level_map = {player["name"]: float(player["level"]) for player in players_list if player.get("name")}
    
    games_played_count = {name: 0 for name in player_names}
    player_streaks = defaultdict(int)
    teammate_pairing_history = set()
    final_match_schedule = []

    def get_match_label(team_1, team_2):
        # Tech: Internal helper using set-based gender comparison. 
        # Func: Dynamically identifies game type (Mixed vs MD/WD) based on player roster.
        def get_team_category(p1, p2):
            genders = {gender_map[p1], gender_map[p2]}
            return "Mixed" if genders == {"M", "F"} else ("Men's" if "M" in genders else "Women's")
        
        type1, type2 = get_team_category(*team_1), get_team_category(*team_2)
        if type1 == "Mixed" and type2 == "Mixed": return "Mixed Doubles" 
        elif type1 == type2: return f"{type1} Doubles" 
        else: return "Doubles"

    search_limit = 12

    # --- MAIN GENERATION LOOP ---
    for game_index in range(1, num_matches_requested + 1):
        # A. FAIRNESS SORT
        # Tech: Lambda sorting with random tie-breaking.
        # Func: Prioritizes players with the lowest game count to ensure fairness.
        sorted_eligible_players = sorted(player_names, key=lambda x: (games_played_count[x], random.random()))
        match_found_for_this_slot = False

        # E. HEURISTIC PHASES
        # Tech: Constraint relaxation strategy.
        # Func: Gradually lowers standards (allowing repeat partners, then ignoring rest) to ensure a match is always found.
        if disable_gender_rules:
            phases = [
                {"respect_rest": True, "respect_partner": True, "force_gender": False}, 
                {"respect_rest": True, "respect_partner": False, "force_gender": False}, 
                {"respect_rest": False, "respect_partner": False, "force_gender": False}
                #{"respect_rest": False, "respect_partner": False, "force_gender": False}
            ]
        else:
            phases = [
                {"respect_rest": True, "respect_partner": True, "force_gender": prioritize_gender_doubles}, 
                {"respect_rest": True, "respect_partner": False, "force_gender": prioritize_gender_doubles}, 
                {"respect_rest": False, "respect_partner": False, "force_gender": False}
            ]
        
        for phase in phases:
            if match_found_for_this_slot: break
            
            # B. SELECTION
            # Tech: Combinatorial iteration. Func: Loops through all possible 4-player sets from the sorted list.
            search_pool = sorted_eligible_players[:search_limit]
            for player_group in combinations(search_pool, 4):

                # --- HARD SKILL GAP FILTER ---
                current_levels = [level_map[p] for p in player_group]
                if (round(max(current_levels)) - round(min(current_levels))) > max_spread_limit:
                    continue

                if phase["respect_rest"] and any(player_streaks[p] >= streak_limit for p in player_group):
                    continue
                
                # Tech: Gender validation. Func: Ensures 4M, 4F, or 2M/2F configurations only.
                if not disable_gender_rules:
                    genders = [gender_map[p] for p in player_group]
                    m_count, f_count = genders.count("M"), genders.count("F")
                    if not (m_count == 4 or f_count == 4 or (m_count == 2 and f_count == 2)):
                        continue

                # D. DYNAMIC GAP OPTIMIZATION
                # Tech: Permutation hard-coding. Func: Evaluates all 3 ways to split 4 players into 2 teams.
                splits = [
                    ((player_group[0], player_group[1]), (player_group[2], player_group[3])), 
                    ((player_group[0], player_group[2]), (player_group[1], player_group[3])), 
                    ((player_group[0], player_group[3]), (player_group[1], player_group[2]))
                ]
                
                valid_options = []
                for t1, t2 in splits:
                    label = get_match_label(t1, t2)
                    
                    if not disable_gender_rules and phase["force_gender"]:
                        if label == "Mixed Doubles" or label == "Doubles": continue 
                    
                    if phase["respect_partner"] and avoid_repeat_partners and (tuple(sorted(t1)) in teammate_pairing_history): 
                        continue
                    
                    # Tech: Absolute difference calculation. Func: Evaluates competitive balance based on skill 'level'.
                    t1_sum, t2_sum = level_map[t1[0]] + level_map[t1[1]], level_map[t2[0]] + level_map[t2[1]]
                    diff = abs(t1_sum - t2_sum)
                    valid_options.append({"t1": t1, "t2": t2, "diff": diff, "label": label, "t1_sum": t1_sum, "t2_sum": t2_sum})
                
                if not valid_options: continue
                
                # Tech: Min() heuristic. Func: Automatically selects the most balanced team split.
                best_match = min(valid_options, key=lambda x: x["diff"])
                t1, t2 = best_match["t1"], best_match["t2"]
                
                # Update Counters
                for p in player_group:
                    games_played_count[p] += 1
                playing_set = set(player_group)
                for p in player_names:
                    if p in playing_set:
                        player_streaks[p] += 1
                    else:
                        player_streaks[p] = 0
                if avoid_repeat_partners:
                    teammate_pairing_history.add(tuple(sorted(t1)))
                    teammate_pairing_history.add(tuple(sorted(t2)))
                
                final_match_schedule.append({
                    "Game": game_index, 
                    "Team 1": f"{t1[0]} & {t1[1]}", 
                    "Team 2": f"{t2[0]} & {t2[1]}", 
                    "Type": best_match["label"], 
                    "T1 Level": int(best_match["t1_sum"]), 
                    "T2 Level": int(best_match["t2_sum"]),
                    "Player Levels": [level_map[p] for p in player_group],
                    "Status": "Waiting"
                })

                match_found_for_this_slot = True
                break
                
    def balance_participation(schedule, counts):
        # Only balance when perfect equal distribution is mathematically possible.
        total_slots = len(schedule) * 4
        if len(player_names) == 0 or total_slots % len(player_names) != 0:
            return schedule, counts

        target = total_slots // len(player_names)

        for enforce_spread in [True, False]:
            # Pass 1: respect spread limit. Pass 2: fallback — ignore spread if gap remains.
            if not any(counts[p] != target for p in player_names):
                break
            improved = True
            while improved:
                improved = False
                for match in schedule:
                    t1_players = match["Team 1"].split(" & ")
                    t2_players = match["Team 2"].split(" & ")
                    match_set = set(t1_players + t2_players)

                    for team_key, team_players, other_players in [
                        ("Team 1", t1_players, t2_players),
                        ("Team 2", t2_players, t1_players),
                    ]:
                        for i, old_player in enumerate(team_players):
                            if counts[old_player] <= target:
                                continue

                            for new_player in player_names:
                                if new_player in match_set:
                                    continue
                                if counts[new_player] >= target:
                                    continue
                                if enforce_spread and not disable_gender_rules and gender_map[new_player] != gender_map[old_player]:
                                    continue

                                new_team = list(team_players)
                                new_team[i] = new_player
                                new_four = new_team + other_players
                                new_levels = [level_map[p] for p in new_four]
                                if enforce_spread and (round(max(new_levels)) - round(min(new_levels))) > max_spread_limit:
                                    continue

                                # Apply swap
                                match[team_key] = f"{new_team[0]} & {new_team[1]}"
                                new_t1 = new_team if team_key == "Team 1" else other_players
                                new_t2 = other_players if team_key == "Team 1" else new_team
                                match["T1 Level"] = int(level_map[new_t1[0]] + level_map[new_t1[1]])
                                match["T2 Level"] = int(level_map[new_t2[0]] + level_map[new_t2[1]])
                                match["Player Levels"] = [level_map[p] for p in new_t1 + new_t2]
                                counts[old_player] -= 1
                                counts[new_player] += 1
                                improved = True
                                break

                            if improved: break
                        if improved: break
                    if improved: break

        return schedule, counts

    final_match_schedule, games_played_count = balance_participation(final_match_schedule, games_played_count)
    return final_match_schedule, games_played_count

# -------------------------------------------------
# Section 4. GLOBAL STATE INITIALIZATION
# -------------------------------------------------
# Tech: st.session_state initialization. 
# Func: Maintains current matches and stats even if the browser page is refreshed.
if "auto_session_id" not in st.session_state: st.session_state.auto_session_id = "new-session"
if "last_matches" not in st.session_state: st.session_state.last_matches = None
if "last_stats" not in st.session_state: st.session_state.last_stats = None

# Tech: Session State List. Func: Stores selected pairs across app reruns.
if "pair_wishlist" not in st.session_state:
    st.session_state.pair_wishlist = []

# Tech: Query Parameter Extraction. Func: Reads the session ID from the URL for easy sharing.
query_params = st.query_params
if st.session_state.auto_session_id == "new-session":
    st.session_state.auto_session_id = query_params.get("session", "match-" + generate_random_id())

is_recovery_attempt = "host" in query_params



# -------------------------------------------------
# Section 5A LANDSCAPE KIOSK (SMART STATUS + UNDO)
# -------------------------------------------------
if "view" in query_params and query_params.get("view") == "kiosk":
    session_id = query_params.get("session", "").strip().lower()
    
    if not session_id:
        st.error("No Session ID found in URL.")
        st.stop()

    @st.cache_data
    def inject_kiosk_css():
        st.markdown("""
            <style>
                .stApp { background-color: #0e1117; }
                header, footer {visibility: hidden;}
                [data-testid="stHeader"] {display: none;}

                /* --- THE FINISH BUTTON HEIGHT --- */
                /* Targets the 'Primary' button type used for Finishing games */
                button[kind="primary"] {
                    height: 150px !important;   /* Increase this for more height */
                    font-size: 35px !important;  /* Makes the text easy to read */
                    font-weight: 900 !important;
                    border-radius: 20px !important;
                    text-transform: uppercase;
                }

                /* --- THE UNDO BUTTON HEIGHT --- */
                /* Kept smaller to avoid accidental taps */
                button[kind="secondary"] {
                    height: 70px !important;
                    margin-top: 10px;
                }

                .court-card {
                    background-color: #1e232d;
                    border: 3px solid #3e4551;
                    border-radius: 25px;
                    padding: 40px 20px;
                    text-align: center;
                    margin-bottom: 10px;
                    min-height: 400px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .game-label {
                    color: #717171; font-size: 12px; font-weight: bold;
                    text-transform: uppercase; margin-bottom: 5px;
                }
                .game-number {
                    color: #00E60E; font-size: 440px; font-weight: 900;
                    line-height: 1; margin: 0;
                }
                .player-names {
                    color: #ffffff; font-size: 16px; font-weight: bold; margin-top: 20px;
                }
            </style>
        """, unsafe_allow_html=True)
    
    inject_kiosk_css()

    # Init State for current games and undo history
    if "kiosk_L" not in st.session_state: st.session_state.kiosk_L = 1
    if "kiosk_R" not in st.session_state: st.session_state.kiosk_R = 2
    if "prev_L" not in st.session_state: st.session_state.prev_L = None
    if "prev_R" not in st.session_state: st.session_state.prev_R = None

    @st.cache_data(ttl=5)
    def get_kiosk_data(sid):
        doc = st.session_state.db.collection("sessions").document(sid).get()
        return doc.to_dict() if doc.exists else None

    if st.session_state.get("db"):
  

        data = get_kiosk_data(session_id)
        
        if data:
            all_matches = data.get("matches", [])
            
            # 1. AUTO-PLAYING SYNC (Ensures games on board are "Playing")
            board_games = [st.session_state.kiosk_L, st.session_state.kiosk_R]
            needs_sync = False
            for m in all_matches:
                if m["Game"] in board_games and m["Status"] in ["Waiting", "Next"]:
                    m["Status"] = "Playing"
                    needs_sync = True
                    
            if needs_sync:
                st.session_state.db.collection("sessions").document(session_id).update({"matches": all_matches})
                get_kiosk_data.clear()

            def get_names(g_num):
                match = next((m for m in all_matches if m["Game"] == g_num), None)
                return f"{match['Team 1']} <br> vs <br> {match['Team 2']}" if match else "EMPTY COURT"

            # 2. FINISH LOGIC (Saves Undo History)
            def finish_and_advance(game_num, court_key, prev_key):
                st.session_state[prev_key] = game_num  # Save to history before advancing
                
                for m in all_matches:
                    if m["Game"] == game_num: m["Status"] = "End"
                
                waiting_games = [m["Game"] for m in all_matches if m["Status"] == "Waiting"]
                if waiting_games:
                    next_game = min(waiting_games)
                    st.session_state[court_key] = next_game
                    for m in all_matches:
                        if m["Game"] == next_game: m["Status"] = "Playing"
                else:
                    st.session_state[court_key] += 2 # Fallback
                
                st.session_state.db.collection("sessions").document(session_id).update({
                    "matches": all_matches, "updated_at": datetime.utcnow()
                })
                get_kiosk_data.clear()

            # 3. UNDO LOGIC
            def perform_undo(court_key, prev_key):
                prev_game = st.session_state[prev_key]
                curr_game = st.session_state[court_key]
                
                # Revert current game back to Waiting
                for m in all_matches:
                    if m["Game"] == curr_game and m["Status"] == "Playing":
                        m["Status"] = "Waiting"
                
                # Revert previous game back to Playing
                for m in all_matches:
                    if m["Game"] == prev_game:
                        m["Status"] = "Playing"
                
                # Update UI state and clear history
                st.session_state[court_key] = prev_game
                st.session_state[prev_key] = None 
                
                st.session_state.db.collection("sessions").document(session_id).update({
                    "matches": all_matches, "updated_at": datetime.utcnow()
                })
                get_kiosk_data.clear()

            # --- UI RENDERING ---
            st.markdown(f"<h1 style='text-align: center; color: white; margin-bottom:30px;'>🏸 {session_id.upper()}</h1>", unsafe_allow_html=True)
            L, R = st.columns(2)

            # --- LEFT COURT ---
            with L:
                st.markdown(f"""
                    <div class="court-card">
                        <div class="game-label">Court 1</div>
                        <div class="game-number">{st.session_state.kiosk_L}</div>
                        <div class="player-names">{get_names(st.session_state.kiosk_L)}</div>
                    </div>
                """, unsafe_allow_html=True)
                
                if st.button(f"FINISH GAME {st.session_state.kiosk_L}", key="L_fin", use_container_width=True, type="primary"):
                    finish_and_advance(st.session_state.kiosk_L, "kiosk_L", "prev_L")
                    st.rerun()
                
                # Disable the undo button if there is no history to undo
                if st.button("↩️ UNDO LAST FINISH", key="L_undo", use_container_width=True, disabled=(st.session_state.prev_L is None)):
                    perform_undo("kiosk_L", "prev_L")
                    st.rerun()

            # --- RIGHT COURT ---
            with R:
                st.markdown(f"""
                    <div class="court-card">
                        <div class="game-label">Court 2</div>
                        <div class="game-number">{st.session_state.kiosk_R}</div>
                        <div class="player-names">{get_names(st.session_state.kiosk_R)}</div>
                    </div>
                """, unsafe_allow_html=True)

                if st.button(f"FINISH GAME {st.session_state.kiosk_R}", key="R_fin", use_container_width=True, type="primary"):
                    finish_and_advance(st.session_state.kiosk_R, "kiosk_R", "prev_R")
                    st.rerun()

                if st.button("↩️ UNDO LAST FINISH", key="R_undo", use_container_width=True, disabled=(st.session_state.prev_R is None)):
                    perform_undo("kiosk_R", "prev_R")
                    st.rerun()
        else:
            st.warning("Waiting for Host to push matches...")
    st.stop()











# -------------------------------------------------
# Section 5. PLAYER VIEW LOGIC (READ-ONLY)
# -------------------------------------------------
# Tech: Logic branching based on URL. Func: Displays a simplified, read-only scoreboard for players.
# -------------------------------------------------
# Section 5. PLAYER VIEW LOGIC (FILTERED)
if "session" in query_params and not is_recovery_attempt:
    session_id = query_params["session"]
    st.title(f"🏸 Live Board: {session_id}")
    
    if "sticky_player_choice" not in st.session_state: 
        st.session_state.sticky_player_choice = "Show All Matches..."
    
    if st.button("🔄 Refresh Matches Now"): st.rerun()

    if st.session_state.get("db"):
        doc = st.session_state.db.collection("sessions").document(session_id.strip().lower()).get()
        if doc.exists:
            data = doc.to_dict()
            df = pd.DataFrame(data.get("matches", []))
            df = df.sort_values(by="Game")
            df = df[["Game", "Status", "Team 1", "Team 2", "Type"]]
            
            # 1. Extract Unique Players
            all_players = set()
            for col in ["Team 1", "Team 2"]:
                for val in df[col]:
                    all_players.update([n.strip() for n in val.split("&")])
            sorted_players = ["Show All Matches..."] + sorted(list(all_players))

            def update_player_choice(): 
                st.session_state.sticky_player_choice = st.session_state.player_dropdown

            st.selectbox("Select your name to see your upcoming matches:", options=sorted_players,
                         index=sorted_players.index(st.session_state.sticky_player_choice) if st.session_state.sticky_player_choice in sorted_players else 0,
                         key="player_dropdown", on_change=update_player_choice)

            # --- 🎯 THE FILTER STEP (THIS IS WHAT REMOVES THE OTHER ROWS) ---
            player_choice = st.session_state.sticky_player_choice
            if player_choice != "Show All Matches...":
                # This line redefines 'df' to ONLY include your matches
                df = df[df["Team 1"].str.contains(player_choice, na=False) | 
                        df["Team 2"].str.contains(player_choice, na=False)]
            # ----------------------------------------------------------------

            def highlight_my_matches(row):
                player = st.session_state.sticky_player_choice
                status = str(row["Status"]).strip()
                bg, txt = "", ""

                if status == "Playing": bg, txt = "#00E60E", "#000000" 
                elif status == "Next": bg, txt = "#e69138", "#000000" 
                elif status == "End": bg, txt = "#990000", "#000000" 
                elif status == "Waiting": bg, txt = "#B5B5B5", "#717171" 
                
                is_mine = player != "Show All Matches..." and (player in str(row["Team 1"]) or player in str(row["Team 2"]))
                final_txt = "#1500b1" if is_mine else txt
                style = f"background-color: {bg}; color: {final_txt}; font-weight: bold;"
                if is_mine: style += " border: 2px solid #8e7cc3; font-style: italic;"

                return [style] * len(row)

            st.dataframe(df.style.apply(highlight_my_matches, axis=1), use_container_width=True, hide_index=True)
            st.caption(f"Last fetched: {get_gmt8_time().strftime('%H:%M:%S')}")
    st.stop()



# -------------------------------------------------
# Section 6. HOST VIEW LOGIC (FULL ACCESS)
# -------------------------------------------------
# Tech: Recovery hydration. Func: Resumes session control using cloud-stored data if the host closes the tab.
if is_recovery_attempt and st.session_state.last_matches is None:
    if st.session_state.get("db"):
        doc = st.session_state.db.collection("sessions").document(query_params.get("session").strip().lower()).get()
        if doc.exists:
            data = doc.to_dict()
            st.session_state.last_matches = data.get("matches", [])
            st.session_state.last_stats = data.get("stats")
            st.session_state.recovered_player_list = data.get("player_list")
            st.session_state.last_push_links = {"session": query_params.get("session"), "host_key": query_params.get("host")}

st.title("🏸 Match Generator (Host)")




with st.sidebar:
    # Tech: Secrets comparison. Func: Prevents unauthorized users from generating matches.
    maintenance_code = st.text_input("Admin Code", type="password")
    is_admin = (maintenance_code == st.secrets["password"])
    
    
    st.subheader("⚙️ Generation Mode")
    # Tech: Sidebar toggle. 
    # Func: Switches between 'Single Match' (Original) and 'Iterative Optimizer' (Wishlist).
    is_iterative = st.toggle("Enable Iterative Optimizer", value=True, help="Runs 50 trials to find the best possible 20-game schedule.")

    st.divider()
    
    st.subheader("🚀 Optimizer Settings")
    # Tech: Sidebar slider. 
    # Func: Controls how many full session simulations the engine runs (The Iterations).
    num_iterations = st.slider("Optimization Trials", min_value=10, max_value=500, value=50, step=10, disabled=not is_iterative)

    st.divider()
    st.header("Rules & Logic")
    avoid_repeats = st.checkbox("No Repeat Partners", value=True)

    # Tech: Integer-based slider. Func: Direct control over the streak_limit fatigue variable.
    streak_limit = st.slider("Streak Limit", 1, 5, 2, help="Maximum consecutive games a player can play.")
    
    disable_gender_rules = st.checkbox("Disable Gender Rules", value=False)
    priority_gender_doubles = st.checkbox("Prioritize MD/WD", value=True, disabled=disable_gender_rules)
    requested_num_matches = st.slider("Number of Matches", 1, 50, 20)
    max_spread_limit = st.slider(
        "Max Skill Gap per Match", 
        0, 5, 2, 
        step = 1,
        help="Limits the level difference between the highest and lowest player in a match. Lower = tighter grouping."
    )

    st.divider()
   
    st.subheader("⚖️ Scoring Weights")
    if not is_iterative:
        st.caption("⚠️ Weights are only used in Iterative mode. Enable the optimizer above to apply these.")

    # Tech: st.number_input with help. 
    # Func: Provides on-hover explanations for how the subtractive scoring judge prioritizes different rules.
    p_streak_weight = st.number_input(
        "Fatigue Penalty (Per Game Over Limit)",
        value=1000,
        disabled=not is_iterative,
        help="Deducts points if a player plays more consecutive games than the 'Streak Limit' allows. Higher values make the engine prioritize rest above all else."
    )

    p_imbalance = st.number_input(
        "Level Imbalance Penalty",
        value=100,
        disabled=not is_iterative,
        help="Deducts points for every 1.0 difference in total skill level between Team 1 and Team 2. Increase this to prioritize more competitive, even matches."
    )

    r_wishlist = st.number_input(
        "Partner Wishlist Reward",
        value=500,
        disabled=not is_iterative,
        help="Adds points to the score if a requested pair from your 'Partner Wishlist' is successfully put on the same team."
    )

    p_repeat_partner = st.number_input(
        "Repeat Partner Penalty",
        value=200,
        disabled=not is_iterative,
        help="Deducts points every time the same two people are paired together more than once in a single session. Higher values force the engine to mix partners more frequently."
    )

    p_fairness_weight = st.number_input(
        "Fairness Penalty (Game Count Gap)",
        value=5000,
        disabled=not is_iterative,
        help="Highest Priority. Penalizes the engine for uneven game counts. Set to 5000+ to force equal participation."
    )

    p_spread_penalty = st.number_input(
        "Level Gap Violation Penalty",
        value=2000,
        disabled=not is_iterative,
        help="Deducts points for every match that exceeds the Max Skill Gap setting."
    )




    # if "last_push_links" in st.session_state:
    #     st.divider()
    #     st.subheader("🔗 Share & Recovery")
    #     links = st.session_state.last_push_links
    #     st.info("Recovery Link (Save this!):")
    #     st.code(f"https://palopalo.streamlit.app/?session={links['session']}&host={links['host_key']}", language="text")
    #     st.info("Player View Link:")
    #     st.code(f"https://palopalo.streamlit.app/?session={links['session']}", language="text")









    st.divider()

    if is_admin:
        if st.button("🗑️ Wipe All Cloud Sessions", type="secondary"):
            if st.session_state.get("db"):
                docs = list(st.session_state.db.collection("sessions").list_documents())
                count = len(docs)
                for d in docs: d.delete()
                if count > 0: st.success(f"Successfully wiped {count} cloud sessions.")


st.subheader("📋 Player Settings")
default_players = [
    # --- Group A (Existing Players) ---
    {"name": "Wes", "gender": "M", "level": 2.1, "payment": "No"}, 
    {"name": "Yelli", "gender": "F", "level": 1.0, "payment": "No"}, 
    {"name": "AJ", "gender": "M", "level": 2.0, "payment": "No"}, 
    {"name": "Mitzie", "gender": "F", "level": 1.0, "payment": "No"}, 
    {"name": "Neil", "gender": "M", "level": 2.0, "payment": "No"}, 
    {"name": "Karen", "gender": "F", "level": 1.0, "payment": "No"}, 
    {"name": "Alex", "gender": "M", "level": 2.0, "payment": "No"}, 
    {"name": "Czarina", "gender": "F", "level": 1.0, "payment": "No"},
    # --- Group B (New Players for 16 Total) ---
    {"name": "Anthony", "gender": "M", "level": 2.0, "payment": "No"},
    {"name": "Daphne", "gender": "F", "level": 1.0, "payment": "No"},
    {"name": "Sim", "gender": "M", "level": 2.0, "payment": "No"},
    {"name": "Kianne", "gender": "F", "level": 1.0, "payment": "No"},
    {"name": "Kevin", "gender": "M", "level": 1.0, "payment": "No"},
    {"name": "Gellie", "gender": "F", "level": 1.1, "payment": "No"},
    {"name": "Ronwald", "gender": "M", "level": 2.0, "payment": "No"},
    {"name": "Tin V", "gender": "F", "level": 1.0, "payment": "No"}
]

# Tech: session_state recovery. Func: Restores the specific player list from the previous session.
initial_list = st.session_state.get("recovered_player_list", default_players)
df_p = pd.DataFrame(initial_list)
if not df_p.empty: 
    df_p = df_p[["name", "gender", "level", "payment"]]
    df_p["level"] = df_p["level"].astype(int)     

# Tech: Real-time UI demographic counting.
# Func: Provides the Host with an instant breakdown of gender counts as the editor is changed.
if "player_editor" in st.session_state:
    editor_state = st.session_state["player_editor"]
    base_men = len(df_p[df_p['gender'] == 'M'])
    base_women = len(df_p[df_p['gender'] == 'F'])
    added_rows = editor_state.get("added_rows", [])
    added_men = sum(1 for r in added_rows if r.get('gender') == 'M')
    added_women = sum(1 for r in added_rows if r.get('gender') == 'F')
    deleted_indices = editor_state.get("deleted_rows", [])
    deleted_men = len(df_p.iloc[deleted_indices][df_p.iloc[deleted_indices]['gender'] == 'M'])
    deleted_women = len(df_p.iloc[deleted_indices][df_p.iloc[deleted_indices]['gender'] == 'F'])
    edited_rows = editor_state.get("edited_rows", {})
    edit_m_change, edit_f_change = 0, 0
    for idx, changes in edited_rows.items():
        if "gender" in changes:
            old, new = df_p.iloc[idx]['gender'], changes["gender"]
            if old == 'M' and new == 'F': edit_m_change -= 1; edit_f_change += 1
            elif old == 'F' and new == 'M': edit_f_change -= 1; edit_m_change += 1
    final_men = base_men + added_men - deleted_men + edit_m_change
    final_women = base_women + added_women - deleted_women + edit_f_change
    current_count = len(df_p) + len(added_rows) - len(deleted_indices)
else:
    final_men, final_women = len(df_p[df_p['gender'] == 'M']), len(df_p[df_p['gender'] == 'F'])
    current_count = len(df_p)

st.markdown(f"**Total Players:** `{current_count}` | **# of Men:** `{final_men}` | **# of Women:** `{final_women}`")

# Tech: st.data_editor with SelectboxColumn. Func: Allows for dynamic roster management with fixed dropdown options.
current_players_input = st.data_editor(
    df_p, 
    column_config={
        "name": st.column_config.TextColumn("Name"), 
        "gender": st.column_config.SelectboxColumn("Gender", options=["M", "F"]), 
        "level": st.column_config.NumberColumn("Level", min_value=1, max_value=99,step=0.1,format="%d"),
        "payment": st.column_config.SelectboxColumn("Payment", options=["Paid", "No"])
    }, 
    num_rows="dynamic", use_container_width=True, key="player_editor", 
    column_order=["name", "gender", "level", "payment"]
)

# if is_admin:
#     if st.button("Generate Matches", type="primary"):
#         # Tech: ID refresh. Func: Ensures every new generation gets a fresh cloud instance.
#         st.session_state.auto_session_id = "match-" + generate_random_id()
#         st.session_state.last_matches, st.session_state.last_stats = generate_matches(
#             current_players_input.to_dict('records'), requested_num_matches, avoid_repeats, 
#             streak_limit, priority_gender_doubles, disable_gender_rules
#         )
if is_admin:
    # 1. THE BUTTON TRIGGER
    if st.button("Generate Matches", type="primary"):
        st.session_state.auto_session_id = "match-" + generate_random_id()
        
        if not is_iterative:
            # ORIGINAL MODE (One pass)
            # Tech: Positional Arguments. 
            # Func: Explicitly passes sidebar settings into the generation engine.
            st.session_state.last_matches, st.session_state.last_stats = generate_matches(
                current_players_input.to_dict('records'), 
                requested_num_matches, 
                avoid_repeats, 
                streak_limit, 
                priority_gender_doubles, 
                disable_gender_rules,
                max_spread_limit
            )
            # Reset the audit since we aren't using the optimizer score here
            st.session_state.last_audit = None
        else:
            # ITERATIVE MODE (The Optimization Loop)
            best_session = None
            best_score = -float('inf')
            
            # Formulate the wishlist string from your sidebar selections
            wishlist_str = ",".join(st.session_state.get("pair_wishlist", []))
            
            progress_bar = st.progress(0)
            
            # --- START OF THE LOOP ---
            for i in range(num_iterations):
                # Generate a candidate version
                m, s = generate_matches(
                    current_players_input.to_dict('records'), requested_num_matches, 
                    avoid_repeats, streak_limit, priority_gender_doubles, disable_gender_rules, max_spread_limit
                )
                
                # --- YOUR TARGET LINE: THE SCORING JUDGE ---
                # Tech: Tuple Unpacking. Func: Captures both the numerical score and the detailed audit dictionary.
                current_score, current_audit = evaluate_session_score(
                    m, wishlist_str, streak_limit, p_streak_weight, p_imbalance, r_wishlist, p_repeat_partner, p_fairness_weight, p_spread_penalty, max_spread_limit)
                
                # If this trial is better than the previous 'best', save it
                if current_score > best_score:
                    best_score = current_score
                    best_session = (m, s)
                    # Save the audit of the winning trial so we can show it on the dashboard
                    # FIX: Save to session_state so the UI can see it after the loop ends
                    st.session_state.best_score = best_score
                    st.session_state.last_audit = current_audit
                
                progress_bar.progress((i + 1) / num_iterations)
            # --- END OF THE LOOP ---

            # Save the 'Winner' to memory
            st.session_state.last_matches, st.session_state.last_stats = best_session
            st.success(f"Optimized Schedule Found! (Score: {best_score})")
else:
    st.info("🔓 Please enter the Admin Code in the sidebar to enable Match Generation.")



# -------------------------------------------------
# Section 6: HOST VIEW - MANUAL EDITOR & PUSH
# -------------------------------------------------
if st.session_state.last_matches:
    st.divider()

    # Tech: 3-column layout for tight left-alignment.
    # Func: The 3rd column is a 'Spacer' that pushes the first two to the left.
    col_t, col_b, col_spacer = st.columns([2.5, 2.8, 5])

    with col_t:
        st.markdown('<h3 style="margin-bottom: 0px; white-space: nowrap;">📋 Match Schedule</h3>', unsafe_allow_html=True)

    with col_b:
        # A small top margin to align the button perfectly with the center of the text
        st.markdown('<div style="margin-top: 5px;"></div>', unsafe_allow_html=True)
        st.button(
            "🚀 Push to Live Board", 
            on_click=push_callback, 
            disabled=not is_admin, 
            type="primary", 
            key="header_push_btn",
            use_container_width=False 
        )

    # --- THE TABLE ---
    df_manual = pd.DataFrame(st.session_state.last_matches).sort_values(by="Game")
    target_order = ["Game", "Status", "Team 1", "Team 2", "Type", "T1 Level", "T2 Level"]

    # Tech: Variable 'updated_matches_df' is born here
    updated_matches_df = st.data_editor(
        df_manual,
        column_order=target_order,
        column_config={
            "Game": st.column_config.NumberColumn("Game", disabled=True, width="None"),
            "Status": st.column_config.TextColumn("Status", disabled=True, width="None"), 
            "Team 1": st.column_config.TextColumn("Team 1 (Edit)", width="None"),
            "Team 2": st.column_config.TextColumn("Team 2 (Edit)", width="None"),
            "Type": st.column_config.SelectboxColumn(
                "Type", 
                options=["Men's Doubles", "Women's Doubles", "Mixed Doubles", "Doubles"],
                width="small",
                required=True
            ),
            "T1 Level": st.column_config.NumberColumn("T1 Lvl", format="%d", disabled=True),
            "T2 Level": st.column_config.NumberColumn("T2 Lvl", format="%d", disabled=True),
        },
        use_container_width=True,
        hide_index=True,
        key="manual_match_editor"
    )
    
    # CRITICAL: This MUST be inside the 'if st.session_state.last_matches' block.
    # It checks if you edited a name in the table and updates Firestore.
    if not updated_matches_df.equals(df_manual):
        st.session_state.last_matches = updated_matches_df.to_dict('records')
        if st.session_state.get("db"):
            st.session_state.db.collection("sessions").document(st.session_state.auto_session_id).update({
                "matches": st.session_state.last_matches
            })

else:
    # This renders if no matches have been generated yet
    st.info("🏸 No matches generated yet. Enter settings in the sidebar and click 'Generate Matches'.")

# --- End of Manual Editor Section ---


### Adding this here cause player list needs to load first at the top of the code ###
with st.sidebar:
    st.subheader("🎯 Partner Wishlist")

    # Tech: List comprehension. Func: Extracts names from the live editor.
    available_names = [p['name'] for p in current_players_input.to_dict('records') if p.get('name')]

    col_w1, col_w2 = st.columns(2)
    with col_w1:
        p1_wish = st.selectbox("Player 1", options=[""] + available_names, key="w1", disabled=not is_iterative)
    with col_w2:
        p2_wish = st.selectbox("Player 2", options=[""] + available_names, key="w2", disabled=not is_iterative)

    # 1. ADD BUTTON LOGIC
    if st.button("Add Pair to Wishlist", disabled=not is_iterative):
        # Validation: Ensure both are selected and are not the same person
        if p1_wish and p2_wish and p1_wish != p2_wish:
            # Sort the names so Wes-Yelli is the same as Yelli-Wes
            new_pair = "-".join(sorted([p1_wish, p2_wish]))
            if new_pair not in st.session_state.pair_wishlist:
                st.session_state.pair_wishlist.append(new_pair)
                st.rerun()

    # 2. DISPLAY LOGIC (Moved OUT of the 'Add' button block)
    # Tech: Sequential rendering. Func: Keeps the wishlist visible throughout the session.
    if st.session_state.pair_wishlist:
        st.divider()
        st.write("**Active Wishes:**")
        for i, pair in enumerate(st.session_state.pair_wishlist):
            st.caption(f"{i+1}. {pair}")
        
        if st.button("Clear Wishlist"):
            st.session_state.pair_wishlist = []
            st.rerun()






if st.session_state.last_matches:
    #st.divider()


    #st.button("🚀 Push Update to Live Board", on_click=push_callback, disabled=not is_admin)

    # # Tech: Firestore .update() via on_change trigger. 
    # # Func: Instantly updates player views when the host changes a match status (Waiting -> Playing -> End).
    # def sync_and_push_changes():
    #     if "host_editor" in st.session_state and st.session_state.get("db"):
    #         for r_idx, changes in st.session_state["host_editor"]["edited_rows"].items():
    #             for k, v in changes.items(): st.session_state.last_matches[r_idx][k] = v
    #         st.session_state.db.collection("sessions").document(st.session_state.auto_session_id).update({"matches": st.session_state.last_matches, "updated_at": datetime.utcnow()})

    

    df_h = pd.DataFrame(st.session_state.last_matches).sort_values(by="Game")
    #df_h = df_h[["Game", "Status", "Team 1", "Team 2", "Type", "T1 Level", "T2 Level"]]

    # Clean list of columns (Shuttlecock removed)
    cols_to_show = ["Game", "Status", "Team 1", "Team 2", "Type", "T1 Level", "T2 Level"]
    df_h = df_h[cols_to_show]

    # THE FIX: This prevents Pandas from rounding whole floats to integers
    df_h["T1 Level"] = df_h["T1 Level"].astype(int)
    df_h["T2 Level"] = df_h["T2 Level"].astype(int)


    
    # # Tech: Triple Nested Ternary. 
    # # Func: Adds Orange for 'Next', keeps Green/Red, and leaves 'Waiting' blank.
    # style_logic = lambda r: (
    # ['background-color: #38761d; color: #65dc31'] * len(r) if r["Status"] == "Playing" else (
    # ['background-color: #e69138; color: #ffffff'] * len(r) if r["Status"] == "Next" else (
    # ['background-color: #990000; color: #ffffff'] * len(r) if r["Status"] == "End" else 
    # [''] * len(r)))
    # )

    






    # You can keep this for safety, but the callback above is what stops the 'flicker'
    #st.session_state.last_matches = updated_df.to_dict('records')




    # --- INSERT THE AUDIT HERE ---
    with st.sidebar:



        st.divider()
        st.write("### 🔍 Roster Audit")

        # 1. Get names from the current editor input
        # Tech: List comprehension & strip(). Func: Normalizes names to catch hidden spaces.
        raw_names = [str(p["name"]).strip() for p in current_players_input.to_dict('records') if p.get("name")]
        
        # 2. Check for Duplicates.
        # Tech: Set comparison. Func: Identifies if the unique count is less than the total count.
        duplicates = set([name for name in raw_names if raw_names.count(name) > 1])

        if duplicates:
            st.error(f"⚠️ **Duplicate Names Found:** {', '.join(duplicates)}")
            st.warning("Duplicates cause math errors in game counts. Please rename or remove them.")
        else:
            st.success("✅ No duplicate names detected.")
            
        # Optional: Quick count display to verify against your physical head count
        st.info(f"Unique Players: {len(set(raw_names))}")


        if "last_push_links" in st.session_state:
            st.divider()
            st.subheader("🔗 Share & Recovery")
            links = st.session_state.last_push_links
            st.info("Recovery Link (Save this!):")
            st.code(f"https://palopalo.streamlit.app/?session={links['session']}&host={links['host_key']}", language="text")
            st.info("Player View Link:")
            st.code(f"https://palopalo.streamlit.app/?session={links['session']}", language="text")

            # Add this to your Sidebar (Section 6)
            st.info("Kiosk View Link (For Tablet):")
            st.code(f"https://palopalo.streamlit.app/?session={links['session']}&view=kiosk", language="text")




    # --- DASHBOARD SECTION ---
    if st.session_state.get("last_audit") and is_iterative:
        st.markdown("### 📊 Engine Audit Report")
        a = st.session_state.last_audit
    
        # Tech: st.metric layout. Func: Displays a high-level summary of the optimization results.
        # Tech: st.metric layout. 
        # Func: Pulls the score from persistent memory (session_state).
        c1, c2, c3, c4, c5, c6 = st.columns(6)
        c1.metric("Wishlist Score", f"{int(st.session_state.get('best_score', 0))}")
        c2.metric("Game Count Violations", f"{a['Participation Gap']} games", 
                  delta="Uneven" if a["Participation Gap"] > 0 else "Perfect", 
                  delta_color="inverse")
        c3.metric("Streak Violations", a["Streak Violations"], delta=None if a["Streak Violations"] == 0 else "Bad", delta_color="inverse")
        c4.metric("Partners Repeated", a["Repeat Partners"])
        c5.metric("Wishes Granted", a["Wishes Granted"], delta=None if a["Wishes Granted"] > 0 else "Zero")
        c6.metric("Skill Gap Violations", a.get("Wide Gaps", 0),
              delta="Poor Quality" if a.get("Wide Gaps", 0) > 0 else "Consistent",
              delta_color="inverse")


        # --- [NEW DETAILED BREAKDOWN START] ---
        with st.expander("Show Detailed Scoring Math", expanded=False):
            st.markdown("### 🧮 Scoring Equation")
            st.write(f"**Starting Base Score:** `10,000`")
            
            # 1. Level Imbalance
            imb_pen = a['Level Gaps'] * p_imbalance
            st.write(f"- **Level Imbalance:** `{a['Level Gaps']:.1f}` x *{p_imbalance}* = `-{imb_pen:.0f}`")
            
            # 2. Participation Fairness (The Big One)
            fair_pen = a['Participation Gap'] * p_fairness_weight
            st.write(f"- **Participation Gap:** `{a['Participation Gap']}` x *{p_fairness_weight}* = `-{fair_pen}`")
            
            # 3. Fatigue / Streaks
            fatigue_pen = a['Streak Violations'] * p_streak_weight
            st.write(f"- **Fatigue Violations:** `{a['Streak Violations']}` x *{p_streak_weight}* = `-{fatigue_pen}`")
            
            # 4. Repeat Partners
            repeat_pen = a['Repeat Partners'] * p_repeat_partner
            st.write(f"- **Repeat Partners:** `{a['Repeat Partners']}` x *{p_repeat_partner}* = `-{repeat_pen}`")
            
            # 5. Skill Spread Violations (Hard Cap)
            spread_pen = a.get("Wide Gaps", 0) * p_spread_penalty
            st.write(f"- **Skill Gap Violations:** `{a.get('Wide Gaps', 0)}` x *{p_spread_penalty}* = `-{spread_pen}`")

            st.divider()
            
            # 6. Wishes (Bonus)
            wish_bonus = a['Wishes Granted'] * r_wishlist
            st.write(f"+ **Wishes Granted:** `{a['Wishes Granted']}` x *{r_wishlist}* = `+{wish_bonus}`")
            
            st.divider()
            # Calculate final logic
            final_calc = 10000 - imb_pen - fair_pen - fatigue_pen - repeat_pen - spread_pen + wish_bonus
            st.markdown(f"**Final Score:** `{int(final_calc)}`")
        # --- [NEW DETAILED BREAKDOWN END] ---

    




    # -----------------------------





    if st.session_state.last_stats:
        st.divider()


        
        # Tech: st.columns layout. Func: Displays participation, match types, and streaks in a 3-column dashboard.
        cl, cr, cb = st.columns([1, 1, 1]) 
        
        with cl:
            st.markdown("**Player Participation**")
            
            # 1. DYNAMIC CALCULATION
            # We count names directly from the current state of last_matches
            dynamic_counts = defaultdict(int)
            for m in st.session_state.last_matches:
                # Split the names (e.g., "Wes & Yelli" -> ["Wes", "Yelli"])
                p1 = [n.strip() for n in m['Team 1'].split('&')]
                p2 = [n.strip() for n in m['Team 2'].split('&')]
                for p in (p1 + p2):
                    if p: # Ensure we don't count empty strings
                        dynamic_counts[p] += 1
            
            # 2. CREATE DATAFRAME
            p_df = pd.DataFrame([
                {"Player": n, "# of Games": c} for n, c in dynamic_counts.items()
            ])
            
            # 3. RENDER CHART
            if not p_df.empty:
                st.altair_chart(alt.Chart(p_df).mark_bar().encode(
                    x=alt.X('# of Games:Q', axis=alt.Axis(format='d')), 
                    y=alt.Y('Player:N', sort='-x'), 
                    color='Player:N'
                ).properties(height=250), use_container_width=True)

        with cr:
            st.markdown("**Match Type Summary**")
            # Tech: value_counts() aggregation. Func: Breaks down the variety of match types generated.
            t_counts = pd.DataFrame(st.session_state.last_matches)["Type"].value_counts().reset_index()
            t_counts.columns = ["Match Type", "Count"]
            
            # Tech: alt.Scale color mapping. Func: Maintains consistent branding (Red/Pink/Green/Gray) for match categories.
            domain = ["Men's Doubles", "Women's Doubles", "Mixed Doubles", "Doubles"]
            range_ = ["red", "pink", "green", "gray"]
            
            st.altair_chart(alt.Chart(t_counts).mark_bar().encode(
                x=alt.X('Count:Q', axis=alt.Axis(format='d')), 
                y=alt.Y('Match Type:N', sort='-x'), 
                color=alt.Color('Match Type:N', scale=alt.Scale(domain=domain, range=range_), legend=None)
            ).properties(height=250), use_container_width=True)

        with cb:
            st.markdown("**🔥 Consecutive Game Audit**")
            
            # 1. Prepare the match list in chronological order
            # Tech: Chronological sequence analysis. 
            # Func: Ignores 'Status' and analyzes the raw game order 1-20.
            all_matches = pd.DataFrame(st.session_state.last_matches).sort_values('Game')
            
            consecutive_violations = []
            player_names = list(st.session_state.last_stats.keys())

            # 2. Iterate through matches to find overlaps
            for i in range(len(all_matches) - 1):
                # Get players in current game (i)
                m1 = all_matches.iloc[i]
                p_set1 = set([n.strip() for n in (m1['Team 1'].split('&') + m1['Team 2'].split('&'))])
                
                # Get players in next game (i + 1)
                m2 = all_matches.iloc[i+1]
                p_set2 = set([n.strip() for n in (m2['Team 1'].split('&') + m2['Team 2'].split('&'))])
                
                # Find the intersection (players in both)
                overlap = p_set1.intersection(p_set2)
                
                for p in overlap:
                    consecutive_violations.append({
                        "Player": p, 
                        "Games": f"{m1['Game']} & {m2['Game']}"
                    })

            # 3. Display the results
            if consecutive_violations:
                viol_df = pd.DataFrame(consecutive_violations)
                st.warning("The following players are scheduled back-to-back:")
                st.dataframe(viol_df, use_container_width=True, hide_index=True)
            else:
                st.success("✅ Clean Schedule: No one breaks the streak limit.")


     # -------------------------------------------------
    # Section 6: HOST VIEW - MATCH CONTROL (REPLACED)
    # -------------------------------------------------

    if st.session_state.last_matches:
        st.subheader("⏱️ Live Match Control")

        status_class_map = {
            "Waiting": "bg-waiting",
            "Next": "bg-next",
            "Playing": "bg-playing",
            "End": "bg-end"
        }

        df_h = pd.DataFrame(st.session_state.last_matches).sort_values(by="Game")

        for i, row in df_h.iterrows():
            current_status = str(row["Status"]).strip()
            bg_class = status_class_map.get(current_status, "bg-waiting")
            
            st.markdown(f"""
                <div class="match-container">
                    <div class="status-bg {bg_class}"></div>
                    <div class="match-content">
                        <span style="font-size: 18px; font-weight: bold; color: #000;">Game {row['Game']}</span><br>
                        <span style="font-size: 18px; color: #000;">
                            {row['Team 1']} &nbsp;&nbsp; <b>VS</b> &nbsp;&nbsp; {row['Team 2']}
                        </span><br>
                        <span style="font-size: 12px; color: #000;">
                            {row['Type']} | T1: {row['T1 Level']:.1f} | T2: {row['T2 Level']:.1f}
                        </span>
                    </div>
                </div>
            """, unsafe_allow_html=True)
            
            # UI: Tappable Status Switcher
            new_status = st.segmented_control(
                label=f"Status_G{row['Game']}",
                options=["Waiting", "Next", "Playing", "End"],
                default=current_status,
                key=f"seg_ctrl_{row['Game']}",
                label_visibility="collapsed"
            )
            
            # Auto-Sync Logic
            if new_status and new_status != current_status:
                st.session_state.last_matches[i]["Status"] = new_status
                if st.session_state.get("db"):
                    st.session_state.db.collection("sessions").document(st.session_state.auto_session_id).update({
                        "matches": st.session_state.last_matches,
                        "updated_at": datetime.utcnow()
                    })
                st.rerun()