import { footerGroups } from "../footerContent"

function externalLinkProps(href) {
  return /^https?:\/\//.test(href)
    ? { target: "_blank", rel: "noreferrer" }
    : {}
}

export default function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <div className="app-footer__meta">
          <a className="app-footer__brand" href="https://kriegspiel.org/">Kriegspiel.org</a>
          <span>Hidden-information chess with referee semantics, modernized for the web.</span>
        </div>
        <div className="app-footer__grid">
          {footerGroups.map((group) => (
            <section key={group.title} className="app-footer__group" aria-label={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.href}`}>
                    <a href={link.href} {...externalLinkProps(link.href)}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </footer>
  )
}
