import { User } from 'src/auth/user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity()
export class Uploads {
  @PrimaryGeneratedColumn()
  @Index()
  id: number;

  @Column()
  @Index()
  fileName: string;

  @Column()
  @Index()
  cleanFileName: string;

  @Column()
  @Index()
  flaggedFileName: string;

  @ManyToOne(() => User, (user) => user.id)
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
