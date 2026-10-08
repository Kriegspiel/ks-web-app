export default function BotAuthorNote({ note }) {
  const parts = note.split(/(https?:\/\/[^\s<>"']+)/gi)

  return (
    <section className="profile-card profile-card--author-note" aria-labelledby="bot-author-note-title">
      <h2 id="bot-author-note-title">About this bot</h2>
      <p className="profile-author-note__attribution">Provided by the bot author.</p>
      <p className="profile-author-note__text">
        {parts.map((part, index) => {
          if (!/^https?:\/\//i.test(part)) return part
          const url = part.replace(/[.,;:!?)}\]]+$/, "")
          // Only link absolute HTTP(S) URLs with a valid host.
          try {
            new URL(url)
          } catch {
            return part
          }
          return (
            <span key={index}>
              <a href={url} target="_blank" rel="ugc noreferrer noopener">{url}</a>
              {part.slice(url.length)}
            </span>
          )
        })}
      </p>
    </section>
  )
}
