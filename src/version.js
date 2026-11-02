// The single source for UI, package, container and GitHub release versions.
export const RELEASE_VERSION='0.4.4-alpha.0'
const [base,prerelease]=RELEASE_VERSION.split('-')
export const APP_VERSION=prerelease?`${base} (${prerelease.split('.')[0].replace(/^./,letter=>letter.toUpperCase())})`:base
export const GITHUB_REPOSITORY_URL = 'https://github.com/staljabro/stage-layout-app'
