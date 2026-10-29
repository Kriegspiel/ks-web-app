export function attemptOverlays(event) {
  const move = String(event.attempt).match(/^([a-h][1-8])([a-h][1-8])[qrbn]?$/i)
  const drop = String(event.attempt).match(/^([PNBRQ])@([a-h][1-8])$/i)
  return {
    arrows: move ? [{ from: move[1], to: move[2], tone: "illegal" }] : [],
    badges: drop ? [{ square: drop[2], label: drop[1].toUpperCase(), tone: "illegal" }] : [],
  }
}
