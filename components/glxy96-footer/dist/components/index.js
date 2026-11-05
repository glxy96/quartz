import { h } from "preact"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * v4 quartz/components/Footer.tsx の移植
 * (b644c31: リンクなし化 / 150cdc9: "© {year} {baseUrl} | Built with Quartz v{version}" 形式)
 * CSS は v4 components/styles/footer.scss と同一
 */
function getQuartzVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"))
    return pkg.version ?? ""
  } catch {
    return ""
  }
}

export const Footer = () => {
  const version = getQuartzVersion()
  const FooterCmp = ({ displayClass, cfg }) => {
    const year = new Date().getFullYear()
    return h(
      "footer",
      { class: displayClass ?? "" },
      h(
        "p",
        null,
        `© ${year} ${cfg?.baseUrl ?? ""} | Built with Quartz v${version}`
      )
    )
  }
  FooterCmp.css = `footer {
  text-align: left;
  margin-bottom: 4rem;
  opacity: 0.7;

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: row;
    gap: 1rem;
    margin-top: -1rem;
  }
}
`
  return FooterCmp
}

export function init() {
  return {}
}
