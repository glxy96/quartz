import { h } from "preact"
import readingTime from "reading-time"

const defaultOptions = {
  showReadingTime: true,
  showComma: true,
}

function formatDate(d, locale) {
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  })
}

function DateCmp({ date, locale }) {
  return h("time", { datetime: date.toISOString() }, formatDate(date, locale))
}

/**
 * v4 quartz/components/ContentMeta.tsx の移植
 * - 公開: <date> / 更新: <date> (modified が published と異なる場合のみ "更新:" を併記)
 * - 読了時間 "X min read" (v4 ja-JP contentMeta.readingTime と同一)
 * - CSS は v4 components/styles/contentMeta.scss と同一 (show-comma 属性でカンマ区切り)
 */
export const ContentMeta = (userOpts) => {
  const options = { ...defaultOptions, ...userOpts }
  function ContentMetadata({ cfg, fileData, displayClass }) {
    const text = fileData.text
    if (!text) return null

    const segments = []
    const locale = cfg?.locale ?? "ja-JP"
    if (fileData.dates) {
      const published = fileData.dates.published
      const modified = fileData.dates.modified
      if (published && modified && published.getTime() !== modified.getTime()) {
        segments.push(
          h(
            "span",
            null,
            "公開: ",
            h(DateCmp, { date: published, locale }),
            " / 更新: ",
            h(DateCmp, { date: modified, locale })
          )
        )
      } else if (published) {
        segments.push(h("span", null, "公開: ", h(DateCmp, { date: published, locale })))
      }
    }

    if (options.showReadingTime) {
      const { minutes } = readingTime(text)
      segments.push(h("span", null, `${Math.ceil(minutes)} min read`))
    }

    return h(
      "p",
      {
        "show-comma": options.showComma,
        class: [displayClass, "content-meta"].filter(Boolean).join(" "),
      },
      segments
    )
  }
  ContentMetadata.css = `.content-meta {
  margin-top: 0;
  color: var(--darkgray);

  &[show-comma="true"] {
    > *:not(:last-child) {
      margin-right: 8px;
      &::after {
        content: ",";
      }
    }
  }
}
`
  return ContentMetadata
}

export function init(options) {
  return options
}
