import type { Contact, Note, Organization } from '../database/models/index.js'

export function serializeContact(contact: Contact) {
  return {
    id: contact.id as number,
    name: contact.name,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    address: contact.address,
    city: contact.city,
    region: contact.region,
    country: contact.country,
    postalCode: contact.postalCode,
    isFavorite: contact.isFavorite,
    avatarUrl: contact.avatarPath ? `/uploads/${contact.avatarPath}` : null,
    organizationId: contact.organizationId,
    organization: contact.organization ? { id: contact.organization.id as number, name: contact.organization.name } : null,
    deletedAt: contact.deletedAt ?? null,
  }
}

export function serializeOrganization(organization: Organization) {
  return {
    id: organization.id as number,
    name: organization.name,
    email: organization.email,
    phone: organization.phone,
    address: organization.address,
    city: organization.city,
    region: organization.region,
    country: organization.country,
    postalCode: organization.postalCode,
    deletedAt: organization.deletedAt ?? null,
  }
}

export function serializeNote(note: Note) {
  return {
    id: note.id as number,
    body: note.body,
    createdAt: note.createdAt as Date,
    author: note.user ? note.user.name : null,
    contact: note.contact ? { id: note.contact.id as number, name: note.contact.name } : null,
  }
}
