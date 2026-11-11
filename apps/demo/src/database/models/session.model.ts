import { Column, DataType, Index, Model, PrimaryKey, Table } from 'sequelize-typescript'

/** Backing table for the Sequelize `express-session` store. */
@Table({ tableName: 'sessions' })
export class Session extends Model {
  @PrimaryKey
  @Column(DataType.STRING)
  declare sid: string

  @Column({ type: DataType.TEXT, allowNull: false })
  declare data: string

  @Index
  @Column({ type: DataType.DATE, allowNull: false })
  declare expiresAt: Date
}
