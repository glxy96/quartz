// Main entry: re-export the component so component-only plugins' init()
// and side-effect imports work (see docs/advanced/creating components.md)
export { ContentMeta, init } from "./components/index.js"
