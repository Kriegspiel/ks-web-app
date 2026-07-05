import { footerGroups } from "../footerContent"

function isExternalHref(href) {
  return /^https?:\/\//.test(href)
}

function externalLinkProps(href) {
  return isExternalHref(href)
    ? { className: "app-footer__link app-footer__link--external", target: "_blank", rel: "noreferrer noopener" }
    : { className: "app-footer__link" }
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
                    <a href={link.href} {...externalLinkProps(link.href)}>
                      {link.label}
                      {isExternalHref(link.href) ? <span className="app-footer__external-icon" aria-hidden="true">&#8599;</span> : null}
                    </a>
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
