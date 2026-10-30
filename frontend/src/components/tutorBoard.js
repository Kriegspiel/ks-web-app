import { overlaysForPlyGroup } from "../utils/replayOverlays"

export function attemptOverlays(event) {
  const move = String(event.attempt).match(/^([a-h][1-8])([a-h][1-8])[qrbn]?$/i)
  const drop = String(event.attempt).match(/^([PNBRQ])@([a-h][1-8])$/i)
  return {
    arrows: move ? [{ from: move[1], to: move[2], tone: "illegal" }] : [],
    badges: drop ? [{ square: drop[2], label: drop[1].toUpperCase(), tone: "illegal" }] : [],
  }
}

export function tutorReplayPositions(events, color) {
  const groups = []
  for (const event of events) {
    const previous = groups.at(-1)
    if (previous && previous[0].turn === event.turn && previous[0].color === event.color) previous.push(event)
    else groups.push([event])
  }
  return groups.map((group) => ({
    ...group.at(-1), before_fen: group[0].before_fen, first_ply: group[0].ply, events: group,
    overlays: overlaysForPlyGroup({ moves: group.map((event) => ({
      uci: event.color === color ? event.attempt : null, move_done: event.answer.move_done, answer: event.answer,
    })) }, group[0].before_fen),
  }))
}
