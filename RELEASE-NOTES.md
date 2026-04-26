# Release Notes

These notes summarize the frontend release history reconstructed from git
history. New runtime releases should add a section at the top when
`frontend/package.json` changes version. Test-only and docs-only changes do not
need version entries unless they ship a user-visible change.

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
