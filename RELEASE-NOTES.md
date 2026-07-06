# Release Notes

These notes summarize the frontend release history reconstructed from git
history. New runtime releases should add a section at the top when
`frontend/package.json` changes version. Test-only and docs-only changes do not
need version entries unless they ship a user-visible change.

## ks-web-app frontend v. 1.3.105

- **Game History URLs**: replace legacy exact opponent filter prefixes like
  `human:notifil` or `bot:randobot` with plain usernames in the address bar.

## ks-web-app frontend v. 1.3.104

- **Bot Matrix Report**: simplify matchup usage rows to average
  input/cache/output tokens and six-decimal average spend.

## ks-web-app frontend v. 1.3.103

- **Profile Metrics Links**: use plain usernames for exact opponent links from
  profile metric rows and bot matrix matchup cells.

## ks-web-app frontend v. 1.3.102

- **Game History Controls**: write exact opponent filters as plain usernames in
  the URL while keeping `All humans` and `All bots` group tokens.

## ks-web-app frontend v. 1.3.101

- **Bot Matrix Report**: rename the tech page label and heading to
  `Bots' matrix`.

## ks-web-app frontend v. 1.3.100

- **Game History**: make the table header row a stronger sticky layer so it
  stays frozen while long game-history tables scroll.

## ks-web-app frontend v. 1.3.99

- **Game History**: remove the dedicated `Open` column now that each row opens
  the game review directly.

## ks-web-app frontend v. 1.3.97

- **Game History Controls**: add `All humans` and `All bots` opponent
  selections backed by compact group-filter URL tokens.

## ks-web-app frontend v. 1.3.92

- **Game History Controls**: load history rows without filter facets by
  default, then fetch complete dropdown values on demand for faster large
  histories.

## ks-web-app frontend v. 1.3.91

- **Bot Matrix Report**: show matchup-specific game-history links in matrix
  cells with the column bot preselected as the opponent.

## ks-web-app frontend v. 1.3.90

- **Game History Controls**: send URL sort/filter state to the backend and use
  server facets/pagination so one-game filters show a complete dropdown menu
  and `Page 1 of 1`.

## ks-web-app frontend v. 1.3.89

- **Bot Matrix Report**: add known-cost-record hover notes and render bot usage
  averages over recorded usage samples only.

## ks-web-app frontend v. 1.3.88

- **Game History Controls**: show inactive sort columns with both up/down
  triangles, keep filter dropdowns from being clipped by short tables, and
  collapse pagination to the filtered result count while filters are active.

## ks-web-app frontend v. 1.3.87

- **Bot Matrix Report**: load the matrix from the live private backend report
  API so Lifetime covers all completed listed bot-vs-bot archives instead of
  the old 55-game static snapshot.

## ks-web-app frontend v. 1.3.86

- **Game History Controls**: move categorical filters into table-header
  dropdowns, add URL-shareable sort/filter/page-size state, use compact
  tri-state sort arrows, and add 100/500/1,000/10,000 games-per-page choices.

## ks-web-app frontend v. 1.3.85

- **Bot Matrix Report**: expand Bot totals with opponent-scope controls,
  sortable columns, total games, per-game averages, and result shares.

## ks-web-app frontend v. 1.3.84

- **Bot Matrix Report**: add a time-period dropdown for Today, Week, Month,
  Year, and Lifetime matrix statistics.

## ks-web-app frontend v. 1.3.83

- **Bot Matrix Report**: keep the outcome matrix player column and opponent
  header row fixed while the matchup cells scroll.

## ks-web-app frontend v. 1.3.82

- **LLM Bot Identity Rename**: updated bot matrix links, bot picker fixtures,
  and report/profile test data to use the `llm_*` model bot usernames and
  visible `LLM ... (bot)` display names.

## ks-web-app frontend v. 1.3.81

- **Bot Matrix Report**: add `/tech/bot-matrix` with the Kriegsspiel bot matrix,
  linked bot names, row matchup aggregates, end-condition counts, and token/cost
  totals.

## ks-web-app frontend v. 1.3.79

- **Footer Links**: map the shared `Playing guide` footer link to the public
  `kriegspiel.org/playing` guide from the app footer.

## ks-web-app frontend v. 1.3.75

- **Private Tech Reports**: require the backend tech-report capability before
  rendering `/tech` and report pages, redirecting unauthenticated visitors to
  login and hiding reports from non-operators.

## ks-web-app frontend v. 1.3.74

- **Campaign Attribution**: capture UTM campaign visits in the app and send
  privacy-minimal visit payloads to the first-party attribution API.
- **Acquisition Report**: add `/tech/acquisition-report` for UTM-sourced visits,
  sessions, acquired users, and created/completed games.

## ks-web-app frontend v. 1.3.68

- **Review Loading**: load completed-game review data through the combined
  review API response, avoiding duplicate game-detail and transcript requests.

## ks-web-app frontend v. 1.3.67

- **Game History**: format machine result reasons such as
  `too_many_reversible_moves` into readable labels.

## ks-web-app frontend v. 1.3.66

- **Bot Profile Metrics**: keep desktop color split labels readable while
  preserving compact mobile opponent and ruleset rows.

## ks-web-app frontend v. 1.3.65

- **Bot Profile Metrics**: keep bot color, opponent, and ruleset stats compact
  on mobile profile pages.

## ks-web-app frontend v. 1.3.63

- **Guest Tech Report**: added a non-timeout endings column to show how many
  guest games completed for a reason other than timeout.

## ks-web-app frontend v. 1.3.62

- **Lobby Empty State**: show a brief message under Open games when there are
  no waiting games to join.

## ks-web-app frontend v. 1.3.61

- **Opening Setup Phantoms**: keep the opponent starting-phantoms toggle
  visible for black after white's first move when the referee log only contains
  turn-start pawn-capture status entries.

## ks-web-app frontend v. 1.3.59

- **Any? Button State**: keep the `Any pawn captures?` control visible in
  rulesets that support it, and disable it when the current ply has already
  used the once-per-ply question.

## ks-web-app frontend v. 1.3.56

- **English En Passant**: show explicit en-passant capture text in live referee
  messages and completed-game review when the API marks a capture as en
  passant.

## ks-web-app frontend v. 1.3.54

- **RAND Stalemate Results**: show RAND stalemates as wins for the
  non-stalemated side in live game summaries, referee logs, and review.

## ks-web-app frontend v. 1.3.53

- **Double Check Announcements**: show the double-check marker plus both
  component check directions in live referee logs and completed-game review.

## ks-web-app frontend v. 1.3.50

- **Opening Setup Phantoms**: changes the opening setup control into a
  Show/Hide toggle for opponent starting phantoms.

## ks-web-app frontend v. 1.3.49

- **Users Tech Report**: render unknown or in-progress game results as `—`
  instead of treating an empty result payload as a draw.

## ks-web-app frontend v. 1.3.48

- **Guest Tech Report**: adds a total time played column for each guest account.

## ks-web-app frontend v. 1.3.47

- **Completed Game Ratings**: shows rating changes from the archived
  game-specific snapshot instead of mixing game-start ratings with the
  player's current ratings after later games.

## ks-web-app frontend v. 1.3.46

- **Review Material Stats**: renders replay material stat labels and numbers
  with regular text weight instead of bold emphasis.

## ks-web-app frontend v. 1.3.45

- **Completed Game Board**: keeps refreshing after a game-over move response
  until the authoritative completed state arrives, so the final board shows all
  pieces after the last move.
- **Phantom Cleanup**: hides and clears local phantom pieces as soon as a game
  finishes.

## ks-web-app frontend v. 1.3.42

- **Social Link Cards**: added OpenGraph/Twitter metadata and a hosted preview
  image so shared `app.kriegspiel.org` links render with a proper card on X
  and other preview crawlers.

## ks-web-app frontend v. 1.3.41

- **Replay Controls**: restores the compact `12W/23B` replay position label
  and uses cleaner symbolic controls for first, previous, play, pause, next,
  and last.

## ks-web-app frontend v. 1.3.40

- **CrazyKrieg Mobile Board**: makes live reserve counts easier to read on
  narrow screens by stacking CrazyKrieg material cards and enlarging reserve
  piece counters.
- **Replay Controls**: moves replay navigation directly under the board and
  adds a Play/Pause control that advances one ply per second.

## ks-web-app frontend v. 1.3.39

- **Game Completion UI**: switches the live page to the finished-game summary
  immediately when a move response says `game_over`, and prevents stale active
  poll responses from replacing an already-completed local state.

## ks-web-app frontend v. 1.3.38

- **Live Game Refresh**: coalesces overlapping game-state polls and forces a
  fresh state refresh after move, ask-any, resign, clock-expiry, and SSE change
  events, preventing active tabs from missing a completed game state when fast
  fallback polling is busy.

## ks-web-app frontend v. 1.3.37

- **Live Timeout Refresh**: refreshes authoritative game state as soon as the
  displayed active clock reaches zero, so timeout losses/wins surface promptly
  in an already-open game tab.
- **Tab Resume Refresh**: refreshes active game state when the game tab regains
  focus or visibility, helping sleeping/background tabs catch up after timeouts
  or missed live events.

## ks-web-app frontend v. 1.3.36

- **Live Game Updates**: subscribes to game server-sent events and refreshes
  state on changes, keeping 500 ms polling only as a fallback.

## ks-web-app frontend v. 1.3.35

- **Material Cards**: top-aligns live and replay material/reserve card content
  so uneven CrazyKrieg reserve panels start from the same vertical edge.

## ks-web-app frontend v. 1.3.34

- **English Review**: hides pawn-capture counts in replay material stats because
  English rules announce capture squares, not captured material type.

## ks-web-app frontend v. 1.3.33

- **Live Game Board**: aligns material and reserve box content to the top so
  uneven CrazyKrieg reserve panels read consistently.

## ks-web-app frontend v. 1.3.32

- **Live Game Board**: prevents stale selected moves from being submitted after
  the authoritative allowed-move list changes, avoiding repeated illegal
  attempts for a move that was already completed.

## ks-web-app frontend v. 1.3.31

- **CrazyKrieg Review**: counts only pieces on the board when showing replay
  material, ignoring Crazyhouse reserve pockets embedded in full FEN strings.

## ks-web-app frontend v. 1.3.30

- **CrazyKrieg Review**: reconstructs public reserves during replay and shows
  read-only White/Black reserve strips below the board, matching the live game
  material view.
- **CrazyKrieg Review**: uses exact capture identity labels such as “Knight
  captured” when the transcript provides reserve identity.

## ks-web-app frontend v. 1.3.29

- **Move Submission**: clears the local “submitting move” state when polling
  confirms the submitted move already advanced the authoritative game state,
  even if the original submit request is still waiting on a browser response.

## ks-web-app frontend v. 1.3.28

- **Replay Overlay**: draws two castling arrows only when the pre-move board
  actually has the moving king on the castling source square, so ordinary rook
  or queen moves like `e1g1` render as a single move arrow.

## ks-web-app frontend v. 1.3.27

- **Replay Layout**: measures the replay board card by its intrinsic board
  content instead of the stretched grid row, so the move-log card stays the
  same visual height as the board card and only the move list scrolls.
- **Replay Controls**: gives replay view/orientation toggles dedicated styles
  so both groups align cleanly on one line without inheriting chart-toggle
  spacing.

## ks-web-app frontend v. 1.3.26

- **Replay Layout**: explicitly syncs the move-log card height to the board
  card height on desktop so only the move list scrolls, and hardens the replay
  toolbar alignment against inherited toggle spacing.

## ks-web-app frontend v. 1.3.25

- **Replay Layout**: made the move-log card stretch to the board card height,
  kept the move rows as the scrollable area, and aligned replay toolbar toggle
  groups by resetting inherited toggle spacing.

## ks-web-app frontend v. 1.3.24

- **Replay Layout**: aligned the replay view and board-bottom controls on a
  proper toolbar grid, stretched the move log to fill the replay card height,
  and moved the game result into Game details.

## ks-web-app frontend v. 1.3.23

- **Replay Layout**: put the replay view and board-bottom controls on one
  compact line above the board, and moved the turn counter into the move-log
  header.

## ks-web-app frontend v. 1.3.22

- **Replay Layout**: tightened the controls above the replay board so view,
  bottom-color, and turn controls no longer crowd each other.
- **Replay Clock**: changed replay clock stats to show estimated time remaining
  instead of elapsed time.

## ks-web-app frontend v. 1.3.21

- **Replay Layout**: moved board orientation controls above the replay board,
  added vertical move-log navigation beside the log, and placed replay time and
  material stats below the board.

## ks-web-app frontend v. 1.3.20

- **Security**: production server now redirects Cloudflare-forwarded HTTP
  traffic to HTTPS before serving the app or proxying API requests.
- **Security**: production responses include HSTS and baseline browser
  hardening headers.

## ks-web-app frontend v. 1.3.19

- **Game State Loading**: fixed a polling race where the board could load but
  the current-message panel stayed stuck on “Loading game state…”.

## ks-web-app frontend v. 1.3.18

- **Guest Conversion**: added a profile-page conversion panel for guest users
  with email/password capture, clear account-claim copy, and a prominent
  “Convert to regular account” action.

## ks-web-app frontend v. 1.3.17

- **RAND Review Log**: displayed RAND pawn-try source-square announcements at
  the start of the next review ply group, matching live game referee messages.

## ks-web-app frontend v. 1.3.16

- **Tech Reports**: added load-duration diagnostics to bots and guests reports,
  and introduced `/tech` as an index page for all tech reports.

## ks-web-app frontend v. 1.3.15

- **Tech Reports**: added a visible load-duration line to
  `/tech/users-report`, including failed request timing for diagnostics.

## ks-web-app frontend v. 1.3.14

- **CrazyKrieg Promotion**: fixed promotion detection when Crazyhouse FEN
  includes promoted-piece `~` markers earlier on the same rank, so dropped
  pawns can promote with the normal promotion picker.

## ks-web-app frontend v. 1.3.13

- **Move Rendering**: made board suggestions and CrazyKrieg drop targets render
  directly from backend-provided `allowed_moves`, removing legacy client-side
  ruleset filtering from referee-log messages.

## ks-web-app frontend v. 1.3.12

- **English/CrazyKrieg Any**: released the local pawn-capture board filter after
  the first failed pawn try, matching the engine rule that only one pawn try is
  required after a positive `Any?`.

## ks-web-app frontend v. 1.3.11

- **CrazyKrieg Review**: marked completed drops on the review board with a
  green circle at the drop square.
- **Referee Display**: hid in-person-only `Nonsense` responses from live and
  review visualizations.
- **Material Panel**: removed redundant side titles below the board and kept
  CrazyKrieg material focused on engine-owned remaining piece counts.

## ks-web-app frontend v. 1.3.10

- **Tech Reports**: added available guest-account capacity to
  `/tech/guests-report` and introduced `/tech/users-report` with DAU, WAU,
  MAU trend charts plus the latest user games.

## ks-web-app frontend v. 1.3.9

- **Bot Rulesets**: stopped treating missing bot compatibility metadata as
  support for every ruleset, so legacy bots no longer appear for CrazyKrieg,
  English, RAND, Cincinnati, or Wild 16 unless the backend says they do.

## ks-web-app frontend v. 1.3.8

- **Rulesets**: exposed RAND, English, and CrazyKrieg in ruleset labels,
  selectors, lobby/game lists, and bot compatibility fallbacks.
- **Footer Rules Links**: kept the app footer aligned with the full public
  rules index, including RAND, English, and CrazyKrieg links.
- **CrazyKrieg Reserves**: added public reserve boxes below the board and
  playable reserve-drop interaction for CrazyKrieg games.

## ks-web-app frontend v. 1.3.7

- **Guests Report**: added `/tech/guests-report`, a tech table listing guest
  names, start days, last game times, and total game counts.

## ks-web-app frontend v. 1.3.6

- **Footer Rules Link**: app footer CrazyKrieg links now point to the public
  `kriegspiel.org` rules page instead of staying relative to the app host.

## ks-web-app frontend v. 1.3.5

- **Auth Legal Notice**: added Terms of Use and Privacy Policy acceptance copy
  to login, register, and guest-play entry points.

## ks-web-app frontend v. 1.3.4

- **Footer Rules Link**: app footer English links now point to the public
  `kriegspiel.org` rules page instead of staying relative to the app host.

## ks-web-app frontend v. 1.3.3

- **Profile Menu**: the header profile dropdown now closes when selecting an
  item, clicking inside the menu surface, pressing Escape, or clicking
  elsewhere on the page.

## ks-web-app frontend v. 1.3.2

- **Profile Copy**: added sentence-ending periods to the profile member-since
  subtitle and rating/results subheadings.

## ks-web-app frontend v. 1.3.1

- **App Navigation**: made the app root open the lobby and simplified the
  authenticated header to `Lobby` plus a `Profile` dropdown with user and
  logout actions.

## ks-web-app frontend v. 1.3.0

- **Guest Play**: added a login-page “Play as guest” flow that creates a
  session-backed guest player and continues into the app without registration.

## ks-web-app frontend v. 1.2.129

- **Board Clocks**: expanded the clock row to the full board width, with each
  clock taking half the board, and kept opening clocks visually paused until
  White completes the first move.

## ks-web-app frontend v. 1.2.128

- **Board Clocks**: moved the game clocks below the board and aligned them to
  the board's right edge.

## ks-web-app frontend v. 1.2.127

- **Opening Phantoms**: moved the one-click opening phantom setup above the
  board and softened phantom pieces so they look more clearly provisional.

## ks-web-app frontend v. 1.2.126

- **Footer Rules Link**: app footer RAND links now point to the public
  `kriegspiel.org` rules page instead of staying relative to the app host.

## ks-web-app frontend v. 1.2.125

- **Material Status Copy**: softened the side labels below the board from
  uppercase color names to `For White` and `For Black`.

## ks-web-app frontend v. 1.2.124

- **Material Status Layout**: the material strip below the board is now split
  into White and Black side-owned cells, mirroring the clock layout above the
  board.

## ks-web-app frontend v. 1.2.123

- **Material Status**: remaining material now uses the backend's
  engine-derived summary, including public pawn-capture counts for Cincinnati
  and Wild 16 while keeping Berkeley pawn counts private.

## ks-web-app frontend v. 1.2.122

- **Referee Log Scrolling**: the in-game referee log now auto-scrolls only after
  a completed turn, not after every illegal attempt or intermediate
  announcement.

## ks-web-app frontend v. 1.2.121

- **Wild 16 Attempts**: stale pawn-try hints now disappear after move attempts,
  matching the server-side Wild 16 attempt state.

## ks-web-app frontend v. 1.2.120

- **Lobby Preferences**: the lobby remembers the last ruleset selected by the
  user and preselects it next time.

## ks-web-app frontend v. 1.2.119

- **Cincinnati Reviews**: review move logs now label Cincinnati pawn-capture
  announcements correctly.

## ks-web-app frontend v. 1.2.118

- **Review Turn Announcements**: turn-start pawn-capture announcements now
  appear at the beginning of the next ply in review logs.

## ks-web-app frontend v. 1.2.117

- **Review Details**: review pages now show the ruleset in game details.

## ks-web-app frontend v. 1.2.116

- **Wild 16 Review Parsing**: fixed Wild 16 pawn-try log parsing in game review.

## ks-web-app frontend v. 1.2.115

- **Illegal Move State**: stale illegal-move messages are cleared when the
  authoritative turn advances.

## ks-web-app frontend v. 1.2.114

- **Game Lists**: lobby and game-history lists now show each game's ruleset.

## ks-web-app frontend v. 1.2.113

- **Wild 16 Current Message**: turn-start pawn-capture status is shown with the
  current player rather than the previous completed move.

## ks-web-app frontend v. 1.2.112

- **Crash Reporting**: added browser Sentry integration with privacy-conscious
  release and environment metadata.

## ks-web-app frontend v. 1.2.111 - 1.2.109

- **Ruleset Isolation**: Berkeley "Any?" controls are hidden outside
  Berkeley+Any games, and stale backend actions are guarded in the UI.
- **New Rulesets**: added frontend flows for Cincinnati and Wild 16 game play,
  including variant-specific announcements, action visibility, and bot support.

## ks-web-app frontend v. 1.2.108 - 1.2.106

- **Current Message Timeline**: simplified the current-message panel into a
  concise timeline that keeps only the latest meaningful statement per side.
- **Announcement Cleanup**: reduced duplicated move-complete, illegal-move,
  capture, and check text in compound referee messages.

## ks-web-app frontend v. 1.2.105 - 1.2.103

- **Footer and Contact**: added Cincinnati to footer links and changed the
  public contact email to `any@kriegspiel.org`.
- **Bot Picker**: bot opponents are sorted by rating and rendered with rating
  first.

## ks-web-app frontend v. 1.2.102 - 1.2.98

- **Game Finished Summary**: completed games now show outcome details, rating
  changes, player links, bot labels, and a review call to action.
- **Move UX**: fixed phantom king moves opening the promotion modal and added
  breathing room around the completed-game box.
- **Turn Highlighting**: the board shell highlights visibly when it is your
  move.
- **Replay Orientation**: a player's own replay defaults to that player's color
  at the bottom.

## ks-web-app frontend v. 1.2.97 - 1.2.94

- **Dark Mode Contrast**: fixed recent-games and game-history contrast in dark
  mode.
- **History Volume**: user history can show up to 100 full-turn rows.
- **Test Stability**: stabilized review navigation and polling regressions.

## ks-web-app frontend v. 1.2.93 - 1.2.84

- **Game Layout**: reworked the game page layout, board/referee sizing,
  referee-log scrolling, action button alignment, and game status cards.
- **Game Messages**: moved notices into the current-message box and unified
  game-page notice handling.
- **Profiles**: opponent names in game details link to public profiles.

## ks-web-app frontend v. 1.2.83 - 1.2.78

- **Clock Smoothness**: game clocks remain monotonic and smooth between polls.
- **Opening Setup**: the opponent phantom setup banner stays visible until the
  player's first move and became more actionable.

## ks-web-app frontend v. 1.2.77 - 1.2.74

- **Default Theme**: the app now defaults to light theme.
- **Auth and Lobby Fixes**: registration conflict errors attach to the relevant
  field, and users can close their own waiting games from the lobby.
- **CI Stability**: restored green frontend CI during the test-hardening work.

## ks-web-app frontend v. 1.2.73 - 1.2.60

- **Home and Game Surfaces**: added all-games links, compact remaining-piece
  status, displayed-piece status, default opponent phantoms, capture tracking,
  and cleaner referee-log badges.
- **Game Sounds**: added optional audio cues for game announcements.
- **Lobby Polish**: streamlined open-game cards and related spacing.

## ks-web-app frontend v. 1.2.59 - 1.2.48

- **Bot Reports**: added the bots report page and per-bot daily breakdown
  tables.
- **Registration UX**: aligned registration validation with relaxed backend
  auth rules and made validation errors more readable.
- **Maintenance**: removed the old legacy `KriegspielGame` component.

## ks-web-app frontend v. 1.2.47 - 1.2.37

- **Game Status**: moved game code into the game status card and refined header
  and selection styling.
- **Rating Charts**: switched to backend rating summaries and chart series,
  polished Elo chart styling, and improved axis/tooltip readability.
- **Review Contrast**: improved review badge contrast in dark theme.
