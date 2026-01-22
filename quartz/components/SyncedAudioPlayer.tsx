import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/syncedAudioPlayer.inline"
import style from "./styles/syncedAudioPlayer.scss"

export default (() => {
  const SyncedAudioPlayer: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    // No SSR markup - client script handles everything
    return null
  }

  SyncedAudioPlayer.css = style
  SyncedAudioPlayer.afterDOMLoaded = script

  return SyncedAudioPlayer
}) satisfies QuartzComponentConstructor
