import { Contact } from './contact.model.js'
import { Note } from './note.model.js'
import { Organization } from './organization.model.js'
import { Session } from './session.model.js'
import { User } from './user.model.js'

export { Contact, Note, Organization, Session, User }

export const models = [User, Organization, Contact, Note, Session]
