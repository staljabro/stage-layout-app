import DesignEditor from './design-editor.jsx'
import './styles.css'
export default function StageOutlineEditor({embeddedStage}) {
  return <div className="design-editor-scope"><DesignEditor embeddedStage={embeddedStage}/></div>
}
