import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  username: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ name: 'api_key', length: 255, unique: true })
  apiKey: string;

  @Column({ length: 20, default: 'developer' })
  role: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
