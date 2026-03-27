export default function RulesPage() {
  return (
    <main className="page-shell rules-page">
      <h1>Rules</h1>
      <p>
        Kriegspiel is hidden-information chess. You only see your own pieces, and the referee announces
        legal feedback after every move attempt.
      </p>

      <section className="rules-card" aria-labelledby="rules-referee-heading">
        <h2 id="rules-referee-heading">Referee announcements</h2>
        <ul>
          <li><strong>Legal move:</strong> your move is accepted and the turn passes.</li>
          <li><strong>Illegal move:</strong> the move is rejected and you must try again.</li>
          <li><strong>Check status:</strong> referee messages indicate when your king is in check.</li>
          <li><strong>Any captures:</strong> use the in-game button to ask if any capture is currently legal.</li>
        </ul>
      </section>

      <section className="rules-card" aria-labelledby="rules-phantom-heading">
        <h2 id="rules-phantom-heading">Phantom model</h2>
        <p>
          Phantom markers are personal notes. They are stored only in your browser per game ID and never
          sent to the backend or shown to your opponent.
        </p>
      </section>
    </main>
  )
}
