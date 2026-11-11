import type { NonAttribute } from 'sequelize'
import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript'
import { Note } from './note.model.js'

@Table({ tableName: 'users' })
export class User extends Model {
  @Column({ type: DataType.STRING, allowNull: false })
  declare firstName: string

  @Column({ type: DataType.STRING, allowNull: false })
  declare lastName: string

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare email: string

  @Column({ type: DataType.STRING, allowNull: false })
  declare password: string

  @HasMany(() => Note)
  declare notes?: NonAttribute<Note[]>

  get name(): string {
    return `${this.firstName} ${this.lastName}`
  }

  /** The user as exposed to the client: never includes the password hash. */
  toPublic() {
    return { id: this.id as number, firstName: this.firstName, lastName: this.lastName, name: this.name, email: this.email }
  }
}
