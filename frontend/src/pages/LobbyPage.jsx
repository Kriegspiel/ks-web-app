import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import TierBadge from "../components/TierBadge"
import VersionStamp from "../components/VersionStamp"
import { useAuth } from "../hooks/useAuth"
import { createGame, deleteWaitingGame, getBots, getGame, getLobbyStats, getMyActiveGames, getOpenGames, joinGame } from "../services/api"
import { formatUtcDateTime } from "../utils/dateTime"
import { DEFAULT_BOT_RULE_VARIANTS, RULESET_OPTIONS, formatRuleVariant } from "../utils/rules"
import "./Lobby.css"

const WAITING_GAME_POLL_MS = 3000
const OPEN_GAMES_POLL_MS = 5000
const MY_GAMES_POLL_MS = 10000
const LOBBY_STATS_POLL_MS = 10000
const ACTIVE_STATES = new Set(["active"])
const RULES_URL = "https://kriegspiel.org/rules"
const DEFAULT_RULE_VARIANT = "berkeley_any"
const LAST_RULE_VARIANT_STORAGE_KEY = "kriegspiel.lastRuleVariant"
const RULESET_VALUES = new Set(RULESET_OPTIONS.map((option) => option.value))
const BOT_TIER_ORDER = ["T0", "T1", "T2", "T3", "T4", "T5"]
const BOT_ACCESS_TIER_ORDER = ["guest", "tier1", "tier2", "tier3", "tier4", "tier5", "tier6"]
const BOT_ACCESS_TIER_BY_CODE = {
  T0: "guest",
  T1: "tier1",
  T2: "tier2",
  T3: "tier3",
  T4: "tier4",
  T5: "tier5",
  T6: "tier6",
}
const BOT_ACCESS_TIER_CODE = {
  guest: "T0",
  tier1: "T1",
  tier2: "T2",
  tier3: "T3",
  tier4: "T4",
  tier5: "T5",
  tier6: "T6",
}
const BOT_TIER_LABELS = {
  T0: "Simple bots",
  T1: "Casual bots",
  T2: "Club bots",
  T3: "Strong bots",
  T4: "Expert bots",
  T5: "Master bots",
}
const BOT_TIER_BY_USERNAME = {
  darkboardmcts: "T1",
  simpleheuristics: "T1",
  stockfishwild: "T1",
  llm_gpt45nano: "T2",
  llm_gptnano: "T2",
  llm_haiku: "T2",
  openrouter_gemini25_lite: "T2",
  openrouter_deepseekv4_flash: "T2",
  openrouter_gptoss120b: "T2",
  openrouter_gemini31_lite: "T2",
  openrouter_llama31_8b: "T2",
  llm_gemini25_lite: "T2",
  llm_deepseekv4_flash: "T2",
  llm_gptoss120b: "T2",
  llm_gemini31_lite: "T2",
  llm_llama31_8b: "T2",
  llm_llama4_scout: "T2",
  llm_llama4_maverick: "T2",
  llm_mistral_nemo: "T2",
  llm_mistral_small32: "T2",
  llm_mistral_large3: "T2",
  llm_gemma3_4b: "T2",
  llm_gemma3_27b: "T2",
  llm_gemma4_31b: "T2",
  llm_glm47_flash: "T2",
  llm_glm45_air: "T2",
  llm_nemotron_nano: "T2",
  llm_nemotron_super: "T2",
  llm_nemotron_ultra: "T3",
  llm_kimi_k25: "T2",
  llm_hermes4_70b: "T2",
  llm_phi4: "T2",
  openrouter_qwen36_flash: "T3",
  llm_qwen36_flash: "T3",
  llm_gpt55: "T3",
  llm_sonnet5: "T3",
  llm_gemini25_flash: "T3",
  llm_qwen_plus: "T3",
  llm_kimi_k2_thinking: "T3",
  llm_hermes3_70b: "T3",
  openrouter_deepseekv4_pro: "T4",
  bot_deepseekv4_pro: "T4",
  llm_opus48: "T4",
  llm_gemini31_pro_preview: "T4",
  llm_glm52: "T4",
  llm_kimi_k27_code: "T4",
  llm_hermes4_405b: "T4",
  llm_gpt55_pro: "T5",
  llm_qwen37_max: "T5",
}

function normalizeRuleVariant(value) {
  const normalized = typeof value === "string" ? value.trim() : ""
  return RULESET_VALUES.has(normalized) ? normalized : DEFAULT_RULE_VARIANT
}

function readPreferredRuleVariant() {
  try {
    return normalizeRuleVariant(window.localStorage?.getItem(LAST_RULE_VARIANT_STORAGE_KEY))
  } catch {
    return DEFAULT_RULE_VARIANT
  }
}

function storePreferredRuleVariant(value) {
  const normalized = normalizeRuleVariant(value)
  try {
    window.localStorage?.setItem(LAST_RULE_VARIANT_STORAGE_KEY, normalized)
  } catch {
    // Storage can be unavailable in private windows; the in-memory selection still works.
  }
  return normalized
}

function normalizeBotDescription(bot) {
  if (!bot || typeof bot !== "object") {
    return ""
  }

  const username = String(bot.username || "").trim().toLowerCase()
  const displayName = String(bot.display_name || "").trim().toLowerCase()
  const description = String(bot.description || "").trim()

  if (
    username === "llm_gpt45nano" ||
    username === "llm_gptnano" ||
    displayName === "llm gpt-4.5 nano (bot)" ||
    displayName === "llm gpt-nano (bot)"
  ) {
    return "LLM GPT-Nano (bot) Kriegspiel model bot."
  }

  if (
    username === "randobot" ||
    displayName === "random bot" ||
    description === "Plays random legal-looking moves"
  ) {
    return "Plays random legal-looking moves."
  }

  return description
}

function preferredBotId(bots) {
  if (!Array.isArray(bots) || bots.length === 0) {
    return ""
  }

  const randomBot = bots.find((bot) => {
    const username = String(bot?.username || "").trim().toLowerCase()
    const displayName = String(bot?.display_name || "").trim().toLowerCase()
    return username === "randobot" || displayName === "random bot"
  })

  return randomBot?.bot_id || bots[0]?.bot_id || ""
}

function botRating(bot) {
  const elo = Number(bot?.elo)
  return Number.isFinite(elo) ? elo : 1200
}

function botTierCode(bot) {
  const username = String(bot?.username || "").trim().toLowerCase()
  return BOT_TIER_BY_USERNAME[username] ?? "T0"
}

function botTierIndex(bot) {
  const index = BOT_TIER_ORDER.indexOf(botTierCode(bot))
  return index === -1 ? BOT_TIER_ORDER.length : index
}

function normalizeBotAccessTier(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/[-_]/g, "") : ""
  if (normalized === "guest" || normalized === "none") return "guest"
  if (/^tier[1-6]$/.test(normalized)) return normalized
  if (/^[1-6]$/.test(normalized)) return `tier${normalized}`
  return ""
}

function viewerBotAccessTier(user) {
  if (user?.is_guest === true || String(user?.role || "").trim().toLowerCase() === "guest") {
    return "guest"
  }

  return normalizeBotAccessTier(user?.llm_bot_tier)
    || normalizeBotAccessTier(user?.current_tier)
    || normalizeBotAccessTier(user?.billing?.tier)
    || "tier1"
}

function botRequiredAccessTier(bot) {
  return normalizeBotAccessTier(bot?.required_tier)
    || BOT_ACCESS_TIER_BY_CODE[botTierCode(bot)]
    || "guest"
}

function tierAllowsBot(viewerTier, requiredTier) {
  const viewerIndex = BOT_ACCESS_TIER_ORDER.indexOf(viewerTier)
  const requiredIndex = BOT_ACCESS_TIER_ORDER.indexOf(requiredTier)
  if (viewerIndex === -1 || requiredIndex === -1) {
    return false
  }
  return viewerIndex >= requiredIndex
}

function botAvailableForViewer(bot, viewerTier) {
  if (typeof bot?.available_for_viewer === "boolean") {
    return bot.available_for_viewer
  }
  return tierAllowsBot(viewerTier, botRequiredAccessTier(bot))
}

function botRequiredTierCode(bot) {
  return BOT_ACCESS_TIER_CODE[botRequiredAccessTier(bot)] ?? botTierCode(bot)
}

function botPickerName(bot) {
  return String(bot?.display_name ?? "Unknown bot").replace(/\s*\(bot\)\s*$/i, "").trim() || "Unknown bot"
}

function botPickerLimitLabel(bot) {
  if (!bot?.llm_backed || typeof bot?.llm_bot_limit_label !== "string") {
    return ""
  }

  const limitLabel = bot.llm_bot_limit_label.trim()
  return /^no\s+ply\s+limit$/i.test(limitLabel) ? "" : limitLabel
}

function formatBotPickerLabel(bot) {
  const limitLabel = botPickerLimitLabel(bot)
  return `${botRating(bot)} - ${botPickerName(bot)}${limitLabel ? ` (${limitLabel})` : ""}`
}

function compareBotPickerBots(left, right) {
  const tierDelta = botTierIndex(left) - botTierIndex(right)
  if (tierDelta !== 0) {
    return tierDelta
  }

  const ratingDelta = botRating(left) - botRating(right)
  if (ratingDelta !== 0) {
    return ratingDelta
  }

  return String(left?.display_name ?? left?.username ?? "").localeCompare(String(right?.display_name ?? right?.username ?? ""))
}

function groupBotsByTier(bots) {
  const groups = new Map(BOT_TIER_ORDER.map((code) => [code, []]))
  bots.forEach((bot) => {
    const code = botTierCode(bot)
    if (!groups.has(code)) {
      groups.set(code, [])
    }
    groups.get(code).push(bot)
  })

  return Array.from(groups.entries())
    .filter(([, tierBots]) => tierBots.length > 0)
    .map(([code, tierBots]) => ({ code, label: BOT_TIER_LABELS[code] ?? `${code} bots`, bots: tierBots }))
}

function safeDomId(value) {
  return String(value || "bot").replace(/[^a-zA-Z0-9_-]/g, "_")
}

function botSupportsRuleVariant(bot, ruleVariant) {
  const supported = Array.isArray(bot?.supported_rule_variants) ? bot.supported_rule_variants : DEFAULT_BOT_RULE_VARIANTS
  return supported.includes(ruleVariant)
}

function BotPickerOptionContent({ bot, unavailable = false }) {
  const limitLabel = unavailable ? "" : botPickerLimitLabel(bot)
  return (
    <>
      <span className="lobby-bot-tier-picker__rating">{botRating(bot)}</span>
      <span className="lobby-bot-tier-picker__separator">-</span>
      <span className="lobby-bot-tier-picker__name">{botPickerName(bot)}</span>
      {unavailable ? <span className="lobby-bot-tier-picker__limit">Requires {botRequiredTierCode(bot)}</span> : null}
      {limitLabel ? <span className="lobby-bot-tier-picker__limit">({limitLabel})</span> : null}
    </>
  )
}

function BotTierPicker({ bots, selectedBotId, isBotAvailable, onChange, onUnavailable }) {
  const labelId = useId()
  const buttonId = useId()
  const listboxId = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [activeBotId, setActiveBotId] = useState("")
  const selectedBot = bots.find((bot) => bot.bot_id === selectedBotId) ?? null
  const groupedBots = useMemo(() => groupBotsByTier(bots), [bots])
  const optionIds = useMemo(
    () => new Map(bots.map((bot) => [bot.bot_id, `${listboxId}-${safeDomId(bot.bot_id)}`])),
    [bots, listboxId],
  )

  useEffect(() => {
    setActiveBotId(selectedBot?.bot_id ?? bots[0]?.bot_id ?? "")
  }, [bots, selectedBot?.bot_id])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    function handlePointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [open])

  const activeIndex = bots.findIndex((bot) => bot.bot_id === activeBotId)

  function moveActive(delta) {
    if (!bots.length) {
      return
    }

    const startIndex = activeIndex === -1 ? 0 : activeIndex
    const nextIndex = (startIndex + delta + bots.length) % bots.length
    setActiveBotId(bots[nextIndex].bot_id)
  }

  function selectBot(botId) {
    if (!botId) {
      return
    }
    const bot = bots.find((item) => item.bot_id === botId)
    if (bot && !isBotAvailable(bot)) {
      setOpen(false)
      onUnavailable?.(bot)
      return
    }
    onChange(botId)
    setOpen(false)
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setActiveBotId(selectedBot?.bot_id ?? bots[0]?.bot_id ?? "")
        return
      }
      moveActive(1)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setActiveBotId(selectedBot?.bot_id ?? bots[0]?.bot_id ?? "")
        return
      }
      moveActive(-1)
      return
    }

    if (event.key === "Home") {
      event.preventDefault()
      setOpen(true)
      setActiveBotId(bots[0]?.bot_id ?? "")
      return
    }

    if (event.key === "End") {
      event.preventDefault()
      setOpen(true)
      setActiveBotId(bots[bots.length - 1]?.bot_id ?? "")
      return
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      if (open) {
        selectBot(activeBotId || selectedBot?.bot_id || bots[0]?.bot_id)
      } else {
        setOpen(true)
      }
      return
    }

    if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="lobby-bot-tier-picker" ref={rootRef}>
      <label id={labelId} htmlFor={buttonId}>Bot opponent</label>
      <button
        id={buttonId}
        type="button"
        role="combobox"
        className="lobby-bot-tier-picker__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-labelledby={labelId}
        aria-activedescendant={open && activeBotId ? optionIds.get(activeBotId) : undefined}
        disabled={!bots.length}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span className="lobby-bot-tier-picker__value">
          {selectedBot ? (
            <>
              <TierBadge code={botTierCode(selectedBot)} className="lobby-bot-tier-picker__badge" aria-hidden="true" />
              <BotPickerOptionContent bot={selectedBot} />
            </>
          ) : (
            <span className="lobby-bot-tier-picker__placeholder">Select a bot</span>
          )}
        </span>
        <span className="lobby-bot-tier-picker__chevron" aria-hidden="true" />
      </button>
      {open && bots.length ? (
        <div id={listboxId} className="lobby-bot-tier-picker__listbox" role="listbox" aria-labelledby={labelId}>
          {groupedBots.map((group) => {
            return (
              <div key={group.code} className="lobby-bot-tier-picker__group" role="group" aria-label={`${group.code} ${group.label}`}>
                <div className="lobby-bot-tier-picker__group-heading">
                  <TierBadge code={group.code} className="lobby-bot-tier-picker__group-badge" aria-hidden="true" />
                  <span className="lobby-bot-tier-picker__group-label">{group.label}</span>
                </div>
                {group.bots.map((bot) => {
                  const selected = bot.bot_id === selectedBotId
                  const active = bot.bot_id === activeBotId
                  const unavailable = !isBotAvailable(bot)
                  return (
                    <div
                      key={bot.bot_id}
                      id={optionIds.get(bot.bot_id)}
                      className={`lobby-bot-tier-picker__option${selected ? " is-selected" : ""}${active ? " is-active" : ""}${unavailable ? " is-unavailable" : ""}`}
                      role="option"
                      aria-label={formatBotPickerLabel(bot)}
                      aria-disabled={unavailable}
                      aria-selected={selected}
                      onMouseEnter={() => setActiveBotId(bot.bot_id)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectBot(bot.bot_id)}
                    >
                      <BotPickerOptionContent bot={bot} unavailable={unavailable} />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function renderCreatorLink(game, botUsernames) {
  const username = String(game?.created_by || "").trim()
  if (!username) {
    return "Unknown"
  }

  const isBot = game?.created_by_role === "bot" || botUsernames.has(username.toLowerCase())

  return (
    <Link to={`/user/${username}`}>
      {username}
      {isBot ? " (bot)" : ""}
    </Link>
  )
}

function isOwnOpenGame(game, username) {
  return String(game?.created_by || "").trim().toLowerCase() === String(username || "").trim().toLowerCase()
}

function isInteractiveRowTarget(target) {
  return Boolean(
    target &&
    typeof target.closest === "function" &&
    target.closest("a, button, input, select, textarea, [role='button'], [role='link']"),
  )
}

function getActiveGame(games) {
  return games.find((game) => ACTIVE_STATES.has(String(game?.state ?? "").toLowerCase())) ?? null
}

function gamePagePath(gameOrCode) {
  if (typeof gameOrCode === "string") {
    const normalized = gameOrCode.trim()
    return normalized ? `/game/${normalized}` : ""
  }

  const gameId = gameOrCode?.game_code ?? gameOrCode?.game_id
  return gameId ? `/game/${gameId}` : ""
}

export default function LobbyPage() {
  const navigate = useNavigate()
  const { user, actionError } = useAuth()
  const [joinCode, setJoinCode] = useState("")
  const [joinError, setJoinError] = useState("")
  const [joiningGame, setJoiningGame] = useState(false)
  const [createResult, setCreateResult] = useState(null)
  const [createError, setCreateError] = useState("")
  const [creatingGame, setCreatingGame] = useState(false)
  const [closingWaitingGame, setClosingWaitingGame] = useState(false)
  const formatCount = useMemo(() => new Intl.NumberFormat("en-US"), [])
  const [waitingGameId, setWaitingGameId] = useState(null)
  const [opponentType, setOpponentType] = useState("human")
  const [ruleVariant, setRuleVariant] = useState(readPreferredRuleVariant)
  const [bots, setBots] = useState([])
  const [botsError, setBotsError] = useState("")
  const [selectedBotId, setSelectedBotId] = useState("")
  const [openGames, setOpenGames] = useState([])
  const [openGamesError, setOpenGamesError] = useState("")
  const [openGamesLoading, setOpenGamesLoading] = useState(true)
  const [myGames, setMyGames] = useState([])
  const [lobbyStats, setLobbyStats] = useState(null)
  const [lobbyStatsError, setLobbyStatsError] = useState("")
  const [lobbyStatsLoading, setLobbyStatsLoading] = useState(true)
  const signedInAs = user?.username ?? user?.email ?? "player"
  const viewerBotTier = useMemo(() => viewerBotAccessTier(user), [user])
  const supportedBots = useMemo(
    () =>
      bots
        .filter((bot) => botSupportsRuleVariant(bot, ruleVariant))
        .sort(compareBotPickerBots),
    [bots, ruleVariant],
  )
  const availableSupportedBots = useMemo(
    () => supportedBots.filter((bot) => botAvailableForViewer(bot, viewerBotTier)),
    [supportedBots, viewerBotTier],
  )
  const selectedBot = availableSupportedBots.find((bot) => bot.bot_id === selectedBotId) ?? null
  const botUsernames = useMemo(
    () =>
      new Set(
        bots
          .map((bot) => String(bot?.username || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    [bots],
  )
  const activeGame = useMemo(() => getActiveGame(myGames), [myGames])
  const playNowPath = gamePagePath(activeGame)
  const sortedOpenGames = useMemo(() => {
    const ownUsername = String(user?.username || "").trim().toLowerCase()
    if (!ownUsername) {
      return openGames
    }

    return [...openGames].sort((left, right) => {
      const leftOwn = isOwnOpenGame(left, ownUsername)
      const rightOwn = isOwnOpenGame(right, ownUsername)
      if (leftOwn === rightOwn) {
        return 0
      }
      return leftOwn ? -1 : 1
    })
  }, [openGames, user?.username])

  async function refreshOpenGames({ markLoading = false } = {}) {
    if (markLoading) {
      setOpenGamesLoading(true)
    }

    try {
      const response = await getOpenGames()
      setOpenGames(Array.isArray(response?.games) ? response.games : [])
      setOpenGamesError("")
    } catch (error) {
      setOpenGamesError(error?.message ?? "Unable to load open games right now.")
    } finally {
      if (markLoading) {
        setOpenGamesLoading(false)
      }
    }
  }

  async function refreshMyGames() {
    try {
      const response = await getMyActiveGames()
      setMyGames(Array.isArray(response?.games) ? response.games : [])
    } catch {
      setMyGames([])
    }
  }

  async function refreshLobbyStats({ markLoading = false } = {}) {
    if (markLoading) {
      setLobbyStatsLoading(true)
    }

    try {
      const response = await getLobbyStats()
      setLobbyStats(response ?? null)
      setLobbyStatsError("")
    } catch (error) {
      setLobbyStatsError(error?.message ?? "Unable to load lobby stats right now.")
    } finally {
      if (markLoading) {
        setLobbyStatsLoading(false)
      }
    }
  }

  const refreshBots = useCallback(async () => {
    try {
      const response = await getBots()
      const available = Array.isArray(response?.bots) ? response.bots : []
      setBots(available)
      setBotsError("")
    } catch (error) {
      setBots([])
      setBotsError(error?.message ?? "Unable to load bots right now.")
    }
  }, [])

  useEffect(() => {
    refreshOpenGames({ markLoading: true })
    const id = window.setInterval(() => refreshOpenGames(), OPEN_GAMES_POLL_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    refreshMyGames()
    const id = window.setInterval(() => refreshMyGames(), MY_GAMES_POLL_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    refreshLobbyStats({ markLoading: true })
    const id = window.setInterval(() => refreshLobbyStats(), LOBBY_STATS_POLL_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    refreshBots()
  }, [refreshBots])

  useEffect(() => {
    if (opponentType !== "bot") {
      return
    }
    if (selectedBotId && availableSupportedBots.some((bot) => bot.bot_id === selectedBotId)) {
      return
    }
    setSelectedBotId(preferredBotId(availableSupportedBots))
  }, [availableSupportedBots, opponentType, selectedBotId])

  useEffect(() => {
    if (!waitingGameId) {
      return undefined
    }

    let cancelled = false

    async function poll() {
      try {
        const game = await getGame(waitingGameId)
        if (cancelled) {
          return
        }

        if (game?.state === "active") {
          setWaitingGameId(null)
          navigate(`/game/${game?.game_code ?? waitingGameId}`)
          return
        }

        if (game?.state && createResult?.state !== game.state) {
          setCreateResult((previous) => ({ ...previous, state: game.state }))
        }
      } catch {
        if (!cancelled) {
          setWaitingGameId(null)
        }
      }
    }

    poll()
    const id = window.setInterval(poll, WAITING_GAME_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [waitingGameId, createResult?.state, navigate])

  const shareJoinUrl = useMemo(() => {
    if (!createResult?.game_code) {
      return ""
    }

    const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : ""
    return `${origin}/join/${createResult.game_code}`
  }, [createResult?.game_code])

  async function handleCreateGame(event) {
    event.preventDefault()
    setCreatingGame(true)
    setCreateError("")

    if (opponentType === "bot" && !selectedBot?.bot_id) {
      setCreatingGame(false)
      setCreateError("Pick an available bot before creating the game.")
      return
    }

    try {
      const created = await createGame({
        rule_variant: ruleVariant,
        play_as: "random",
        time_control: "rapid",
        opponent_type: opponentType,
        bot_id: opponentType === "bot" ? selectedBot.bot_id : undefined,
      })
      setCreateResult(created)

      if (created.state === "active") {
        await Promise.all([refreshOpenGames(), refreshMyGames()])
        navigate(`/game/${created.game_code ?? created.game_id}`)
        return
      }

      setWaitingGameId(created.game_id)
      await Promise.all([refreshOpenGames(), refreshMyGames()])
    } catch (error) {
      setCreateResult(null)
      setWaitingGameId(null)
      setCreateError(error?.message ?? "Unable to create game right now.")
    } finally {
      setCreatingGame(false)
    }
  }

  function handleRuleVariantChange(event) {
    setRuleVariant(storePreferredRuleVariant(event.target.value))
  }

  async function handleJoinByCode(event) {
    event.preventDefault()
    const normalizedCode = joinCode.trim().toUpperCase()
    if (!normalizedCode) {
      setJoinError("Enter a game code to join.")
      return
    }

    setJoiningGame(true)
    setJoinError("")

    try {
      const joined = await joinGame(normalizedCode)
      setJoinCode("")
      await Promise.all([refreshOpenGames(), refreshMyGames()])
      navigate(gamePagePath(joined))
    } catch (error) {
      if (error?.status === 409 && error?.code === "CANNOT_JOIN_OWN_GAME") {
        setJoinCode("")
        navigate(gamePagePath(normalizedCode))
        return
      }

      setJoinError(error?.message ?? "Unable to join that game right now.")
    } finally {
      setJoiningGame(false)
    }
  }

  async function handleJoinOpenGame(gameCode) {
    setJoinCode(gameCode)
    setJoiningGame(true)
    setJoinError("")

    try {
      const joined = await joinGame(gameCode)
      await Promise.all([refreshOpenGames(), refreshMyGames()])
      navigate(gamePagePath(joined))
    } catch (error) {
      if (error?.status === 409 && error?.code === "CANNOT_JOIN_OWN_GAME") {
        navigate(gamePagePath(gameCode))
        return
      }

      setJoinError(error?.message ?? "Unable to join that game right now.")
    } finally {
      setJoiningGame(false)
    }
  }

  function handleOpenGameRowClick(event, game) {
    if (isOwnOpenGame(game, user?.username) || isInteractiveRowTarget(event.target)) {
      return
    }

    handleJoinOpenGame(game.game_code)
  }

  async function handleCloseWaitingGame(gameRef) {
    const targetCode = String(gameRef?.game_code || "").trim().toUpperCase()
    const targetId = String(gameRef?.game_id || "").trim()
    const target = targetCode || targetId

    if (!target) {
      return
    }

    setClosingWaitingGame(true)
    setCreateError("")
    setJoinError("")

    try {
      await deleteWaitingGame(target)
      setOpenGames((previous) => previous.filter((game) => String(game?.game_code || "").trim().toUpperCase() !== targetCode))
      if (waitingGameId === targetId || (targetCode && String(createResult?.game_code || "").trim().toUpperCase() === targetCode)) {
        setWaitingGameId(null)
      }
      if (createResult?.game_id === targetId || (targetCode && String(createResult?.game_code || "").trim().toUpperCase() === targetCode)) {
        setCreateResult(null)
      }
      await Promise.all([refreshOpenGames(), refreshMyGames()])
    } catch (error) {
      setCreateError(error?.message ?? "Unable to close this waiting game right now.")
    } finally {
      setClosingWaitingGame(false)
    }
  }

  return (
    <main className="page-shell lobby-page">
      <div className="lobby-page__header">
        <div className="lobby-page__title-block">
          <h1>Lobby</h1>
        </div>
        <p>Signed in as {signedInAs}.</p>
      </div>
      <nav className="inline-links lobby-page__quick-actions" aria-label="Lobby quick actions">
        {playNowPath ? <Link to={playNowPath}>Resume active game</Link> : null}
        <Link to="/leaderboard">Leaderboard</Link>
        <a href={RULES_URL} target="_blank" rel="noreferrer noopener" aria-label="Read rules (opens external page)">
          Read rules ↗
        </a>
      </nav>

      {actionError ? <p className="auth-error" role="alert">{actionError}</p> : null}

      <section className="lobby-card" aria-labelledby="create-game-heading">
        <h2 id="create-game-heading">Create game</h2>
        <form onSubmit={handleCreateGame} className="lobby-create-form">
          <div className="lobby-create-grid">
            <div className="lobby-create-field">
              <label htmlFor="ruleset-picker">Ruleset</label>
              <select id="ruleset-picker" value={ruleVariant} onChange={handleRuleVariantChange}>
                {RULESET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="lobby-create-field">
            <span className="lobby-create-field__label">Who is this game against?</span>
            <div className="lobby-opponent-options">
              <div className={`lobby-opponent-option${opponentType === "human" ? " is-selected" : ""}`}>
                <label className="lobby-opponent-option__radio">
                  <input type="radio" aria-label="Human" name="opponent-type" checked={opponentType === "human"} onChange={() => setOpponentType("human")} />
                  <span className="lobby-opponent-copy">
                    <span className="lobby-opponent-title">Human</span>
                    <span className="lobby-opponent-description">Play another human.</span>
                  </span>
                </label>
              </div>

              <div className={`lobby-opponent-option${opponentType === "bot" ? " is-selected" : ""}`}>
                <label className="lobby-opponent-option__radio">
                  <input type="radio" aria-label="Bot" name="opponent-type" checked={opponentType === "bot"} onChange={() => setOpponentType("bot")} />
                  <span className="lobby-opponent-copy">
                    <span className="lobby-opponent-title">Bot</span>
                    <span className="lobby-opponent-description">Start immediately against an available bot.</span>
                  </span>
                </label>

                {opponentType === "bot" ? (
                  <div className="lobby-bot-picker">
                    <BotTierPicker
                      bots={supportedBots}
                      selectedBotId={selectedBotId}
                      isBotAvailable={(bot) => botAvailableForViewer(bot, viewerBotTier)}
                      onChange={setSelectedBotId}
                      onUnavailable={() => navigate("/subscription")}
                    />
                    {!supportedBots.length ? <p className="lobby-meta">No bots support this ruleset.</p> : null}
                    {supportedBots.length > 0 && !availableSupportedBots.length ? (
                      <p className="lobby-meta">Upgrade your tier to play bots for this ruleset.</p>
                    ) : null}
                    {selectedBot ? <p className="lobby-meta">{normalizeBotDescription(selectedBot)}</p> : null}
                    {botsError ? <p className="auth-error" role="alert">{botsError}</p> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <button type="submit" disabled={creatingGame}>
            {creatingGame ? "Creating…" : opponentType === "bot" ? "Create bot game" : "Create waiting game"}
          </button>
        </form>

        {createError ? <p className="auth-error" role="alert">{createError}</p> : null}

        {createResult && createResult.state === "waiting" ? (
          <div className="lobby-created-game" role="status" aria-live="polite">
            <p><strong>Join code:</strong> <code>{createResult.game_code}</code></p>
            <p><strong>Share link:</strong> <a href={shareJoinUrl}>{shareJoinUrl}</a></p>
            <p><strong>State:</strong> {waitingGameId ? "Waiting for opponent…" : createResult.state}</p>
            <button
              type="button"
              className="game-danger-button"
              onClick={() => handleCloseWaitingGame({ game_id: createResult.game_id, game_code: createResult.game_code })}
              disabled={closingWaitingGame}
            >
              {closingWaitingGame ? "Closing…" : "Close"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="lobby-card" aria-labelledby="open-games-heading">
        <h2 id="open-games-heading">Open games</h2>
        {openGamesError ? <p role="alert">{openGamesError}</p> : null}
        {openGamesLoading ? <p>Loading…</p> : null}
        {!openGamesLoading && !openGamesError && sortedOpenGames.length === 0 ? (
          <p className="lobby-meta">No open games yet. Create a waiting game and it will appear here.</p>
        ) : null}
        {sortedOpenGames.length > 0 ? (
          <ul className="lobby-list lobby-open-games-list">
            {sortedOpenGames.map((game, index) => {
              const ownOpenGame = isOwnOpenGame(game, user?.username)
              return (
                <li
                  key={game.game_code ?? game.game_id ?? `open-game-${index}`}
                  className={ownOpenGame ? undefined : "is-joinable"}
                  onClick={ownOpenGame ? undefined : (event) => handleOpenGameRowClick(event, game)}
                >
                  <div className="lobby-open-game">
                    <div className="lobby-open-game__opponent">
                      {renderCreatorLink(game, botUsernames)}
                    </div>
                    <div className="lobby-open-game__match">
                      <span>Rules: {formatRuleVariant(game.rule_variant)}</span>
                      {game.available_color ? <span>Color: {game.available_color}</span> : null}
                    </div>
                    <div className="lobby-open-game__meta">
                      <span className="lobby-open-game__time">{formatUtcDateTime(game.created_at)}</span>
                      <span className="lobby-open-game__meta-separator" aria-hidden="true" />
                      <code className="lobby-open-game__code">{game.game_code ?? game.game_id ?? "Unknown code"}</code>
                    </div>
                  </div>
                  <div className="lobby-list__actions">
                    {ownOpenGame ? (
                      <>
                        <button type="button" onClick={() => navigate(gamePagePath(game))}>Open</button>
                        <button
                          type="button"
                          className="game-danger-button"
                          onClick={() => handleCloseWaitingGame({ game_id: game.game_id, game_code: game.game_code })}
                          disabled={closingWaitingGame}
                        >
                          {closingWaitingGame ? "Closing…" : "Close"}
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => handleJoinOpenGame(game.game_code)}>Join</button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>

      <section className="lobby-card" aria-labelledby="join-game-heading">
        <h2 id="join-game-heading">Join by code</h2>
        <form onSubmit={handleJoinByCode} className="lobby-join-form">
          <label htmlFor="join-game-code">Game code</label>
          <input
            id="join-game-code"
            name="join-game-code"
            autoComplete="off"
            maxLength={6}
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
          />
          <button type="submit" disabled={joiningGame}>{joiningGame ? "Joining…" : "Join game"}</button>
        </form>
        {joinError ? <p className="auth-error" role="alert">{joinError}</p> : null}
      </section>

      <section className="lobby-card" aria-labelledby="lobby-stats-heading">
        <h2 id="lobby-stats-heading">Lobby stats</h2>
        {lobbyStatsError ? <p role="alert">{lobbyStatsError}</p> : null}
        {lobbyStatsLoading ? <p>Loading…</p> : null}
        {lobbyStats ? (
          <div className="lobby-stats-grid">
            <div className="lobby-stats-tile">
              <strong>{formatCount.format(lobbyStats.active_games_now ?? 0)}</strong>
              <span>Active games now</span>
            </div>
            <div className="lobby-stats-tile">
              <strong>{formatCount.format(lobbyStats.completed_last_hour ?? 0)}</strong>
              <span>Completed last hour</span>
            </div>
            <div className="lobby-stats-tile">
              <strong>{formatCount.format(lobbyStats.completed_last_24_hours ?? 0)}</strong>
              <span>Completed last 24 hours</span>
            </div>
            <div className="lobby-stats-tile">
              <strong>{formatCount.format(lobbyStats.completed_total ?? 0)}</strong>
              <span>Completed total</span>
            </div>
          </div>
        ) : null}
      </section>

      <VersionStamp className="lobby-page__footer-version" />
    </main>
  )
}
