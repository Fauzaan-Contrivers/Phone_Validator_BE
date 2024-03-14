
import { Uploads } from 'src/uploads/uploads.entity';
import { Entity, Column, PrimaryGeneratedColumn, OneToMany, Int32 } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string;

  @Column({ type: 'varchar', length: 50 })
  role: string;

  @Column({ type: 'int', default: 20000 })
  uploadLimit: number;

  @Column({ type: 'int', default: 20000 })
  availableLimit: number;

  @OneToMany(() => Uploads, sheet => sheet.createdBy)
  sheets: Uploads[];
}
