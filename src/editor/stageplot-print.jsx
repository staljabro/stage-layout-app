import {validOrganisationLogo} from '../organisation-logo.js'

export function StageplotPrintHeading({organisation,layoutName,stageName}) {
  return <div className="canvas-print-heading">
    {validOrganisationLogo(organisation?.logo)&&<img src={organisation.logo} alt={`${organisation.name} logo`}/>}
    <div className="canvas-print-details">
      {organisation?.name&&<div>{organisation.name}</div>}
      {layoutName&&<div>{layoutName}</div>}
      <div>{stageName}</div>
    </div>
  </div>
}
