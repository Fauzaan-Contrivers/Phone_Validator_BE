import { User } from 'src/auth/user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';

@Entity()
export class Uploads {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fileName: string;

  @Column({ default: null })
  cleanFileName: string;

  @Column({ default: null })
  flaggedFileName: string;

  @Column({ default: 0 })
  totalCount: number;

  @Column({ default: 0 })
  cleaned: number;

  @Column({ default: 0 })
  duplicate: number;

  @ManyToOne(() => User, (user) => user.id)
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
