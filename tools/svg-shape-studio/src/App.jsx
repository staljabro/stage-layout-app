// Compatibility entry for integrations that embed the shared drawing editor.
import DesignEditor from '../../../src/editor/design-editor.jsx'
import '../../../src/editor/styles.css'
export default function App(props) {return <div className="design-editor-scope"><DesignEditor {...props}/></div>}
