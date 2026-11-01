import {validOrganisationLogo} from './organisation-logo.js'

export function OrganisationBranding({organisation}) {
  if(!organisation)return null
  return <div className="organisation-branding">{validOrganisationLogo(organisation.logo)&&<img src={organisation.logo} alt={`${organisation.name} logo`}/>}<span>{organisation.name}</span></div>
}
