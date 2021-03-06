const html = require('choo/html')
const { api } = require('../../util')

const store = (state, emitter) => {
  const reset = () => state.authorizedUsers = {
    // null if unloaded, array if loaded
    authorizedList: null,
    unauthorizedList: null,

    fetching: false,
    fetched: false,

    // true once save is pressed; false when the textarea is changed
    authMessageSaved: false,
  }

  reset()

  emitter.on('authorizedUsers.fetch', async () => {
    if (
      // this entire section is irrelevant if the server doesn't require
      // authorization..
      state.serverRequiresAuthorization === false ||

      // and it definitely won't work if the user is logged out
      state.session.id === null
    ) return

    state.authorizedUsers.fetching = true

    const { users, unauthorizedUsers } = await api.get(state, 'users')
    state.authorizedUsers.authorizedList = users
    state.authorizedUsers.unauthorizedList = unauthorizedUsers

    const { settings: { authorizationMessage } } = await api.get(state, 'settings')
    state.authorizedUsers.authorizationMessage = authorizationMessage

    state.authorizedUsers.fetching = false
    state.authorizedUsers.fetched = true
    emitter.emit('render')
  })

  emitter.on('authorizedUsers.saveMessage', async () => {
    const authorizationMessage = document.getElementById(`authorized-users-message`).value

    await api.post(state, 'settings', {authorizationMessage})

    state.authorizedUsers.authorizationMessage = authorizationMessage
    state.authorizedUsers.authMessageSaved = true

    emitter.emit('render')
  })

  emitter.on('authorizedUsers.authorizeUser', async userID => {
    await api.patch(state, `users/${userID}`, {authorized: true})

    emitter.emit('authorizedUsers.fetch')
  })

  emitter.on('authorizedUsers.deauthorizeUser', async userID => {
    await api.patch(state, `users/${userID}`, {authorized: false})

    emitter.emit('authorizedUsers.fetch')
  })

  emitter.on('authorizedUsers.textareaChanged', value => {
    state.authorizedUsers.authMessageSaved = false
    emitter.emit('render')
  })
}

const component = (state, emit) => {
  if (state.authorizedUsers.fetched === false) {
    if (!state.authorizedUsers.fetching) {
      emit('authorizedUsers.fetch')
    }

    return html`<div class='Page AuthorizedUsers'>
      <h1 class='Page-title'>Authorized users <span class='Page-subtitle'>on ${state.params.host}</span></h1>

      Loading...
    </div>`
  }

  const makeUserRow = (user, actionTD) => {
    const row = html`<tr data-userid=${user.id}>
      <td>
        <img class='Avatar' width='32' height='32' src=${user.avatarURL}/>
      </td>

      <td>
        ${user.username} <span class='AuthorizedUsers-userID'>(ID: <span>${user.id}</span>)</span>
      </td>

      ${actionTD}
    </tr>`

    row.isSameNode = el => el.dataset && el.dataset.userid === user.id

    return row
  }

  const makeUserRows = (list, makeActionTD) => {
    const sortedList = list.slice(0).sort((a, b) => {
      const an = a.username || '', bn = b.username || ''
      return an > bn ? 1 : an < bn ? -1 : 0
    })

    return sortedList.map(user => makeUserRow(user, makeActionTD(user)))
  }

  const authorizedRows = makeUserRows(state.authorizedUsers.authorizedList,
    user => html`
      <td>
        <button
          class='Button --no-bg --red'
          disabled=${user.id === state.session.user.id}
          title=${user.id === state.session.user.id
            ? 'You can\'t deauthorize yourself.' : ''}
          onclick=${() => emit('authorizedUsers.deauthorizeUser', user.id)}
        >Deauthorize</button>
      </td>
    `
  )

  const unauthorizedRows = makeUserRows(state.authorizedUsers.unauthorizedList,
    user => html`
      <td>
        <button
          class='Button --no-bg'
          onclick=${() => emit('authorizedUsers.authorizeUser', user.id)}
        >Authorize</button>
      </td>
    `
  )

  const considerEmittingChanged = () => {
    if (state.authorizedUsers.authMessageSaved === true) {
      if (state.authorizedUsers.authorizationMessage !== textarea.value) {
        emit('authorizedUsers.textareaChanged')
      }
    }
  }

  const textarea = html`
    <textarea
      id='authorized-users-essage'
      placeholder='Authorization message'
      maxlength='800'
      class='Textarea'
      onchange=${considerEmittingChanged}
      onkeyup=${considerEmittingChanged}
    >${state.authorizedUsers.authorizationMessage}</textarea>
  `

  textarea.isSameNode = el => el.id === textarea.id

  return html`<div class='Page AuthorizedUsers'>
    <h1 class='Page-title'>Authorized users <span class='Page-subtitle'>on ${state.params.host}</span></h1>

    <p>
      De-authorize users below. They won't be able to read or send messages,
      view channels, etc. until authorized again.
    </p>

    <table class='AuthorizedUsers-table Table'>
      <tbody>
        ${authorizedRows}
      </tbody>
    </table>

    <h2>Unauthorized users</h2>

    <p>
      Authorize users below. These users currently can't read or send messages.
      Once you've authorized them, they will be able to.
    </p>

    <table class='AuthorizedUsers-table Table'>
      <tbody>
        ${unauthorizedRows}
      </tbody>
    </table>

    <h2>Authorization message</h2>

    <p>This is shown to users who have registered and logged in, but aren't authorized.</p>

    <p>Must be under 800 characters; may contain basic markdown formatting.</p>

    <p>${textarea}</p>

    <p>
      <button class='Button' onclick=${() => emit('authorizedUsers.saveMessage')}>Save message</button>
      ${state.authorizedUsers.authMessageSaved ? html`<span class='status'>Saved.</span>` : ''}
    </p>
  </div>`
}

module.exports = { store, component }
