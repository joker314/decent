'use strict'

// Utility functions:

function post(path, dataObj) {
  return fetch(serverURL.value + '/api/' + path, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dataObj)
  }).then(res => res.json())
}

function get(path, dataObj) {
  const esc = encodeURIComponent
  const queryString = Object.keys(query).length > 0
    ? '?' + Object.keys(query)
      .map(k => esc(k) + '=' + esc(query[k]))
      .join('&')
    : ''

  return fetch(serverURL.value + '/api/' + path + queryString)
    .then(res => res.json())
}

// The actual client code:

const serverDict = new Dictionary()
const activeServerHostname = new Value()
const currentServer = new Reference(serverDict, activeServerHostname)
const sessionID = new Reference(currentServer, 'sessionID')

const serverURL = new Computed(
  [activeServerHostname],
  hostname => '//' + hostname)

sessionID.onChange(id => {
  console.log('New session ID:', id)
})

function addServer(serverHostname) {
  serverDict[serverHostname] = new Dictionary({
    sessionID: null
  })

  activeServerHostname.set(serverHostname)
}

addServer('localhost:2999')

document.getElementById('login').addEventListener('click', async () => {
  if (currentServer.value === null) {
    alert('Excuse me, you aren\'t on a server???')
  }

  const username = prompt('Username?')
  const password = prompt('Password? (Insert speel about DON\'T SEND SENSITIVE PASSWORDS OVER HTTP here)')

  if (username && password) {
    const result = await post('login', {username, password})

    if (result.success === true) {
      currentServer.value.sessionID = result.sessionID
    }
  }
})
