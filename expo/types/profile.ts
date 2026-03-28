export interface Comment {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: Date;
}

export interface Profile {
  id: string;
  name: string;
  age: number;
  city: string;
  description: string;
  profileImageUrl: string;
  profileImageThumbUrl?: string;
  uploaderUserId: string;
  uploaderUsername: string;
  creatorGender?: GenderOption;
  greenFlags: number;
  redFlags: number;
  commentCount: number;
  comments: Comment[];
  userVote: 'green' | 'red' | null;
  createdAt: Date;
  approvalStatus: 'pending' | 'approved' | 'rejected';
}

export type UserStatus = 'pending_verification' | 'approved_username_assigned' | 'rejected';
export type GenderOption = 'male' | 'female' | 'other';
export type AuthMethod = 'email_password' | 'google';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location: string;
  selfieUrl: string;
  status: UserStatus;
  username?: string;
  gender?: GenderOption;
  dateOfBirth?: Date;
  authMethod?: AuthMethod;
  googleAuthProvider?: boolean;
  createdAt: Date;
  approvedAt?: Date;
}

export interface RegistrationData {
  name: string;
  email: string;
  phone?: string;
  location: string;
  password: string;
  confirmPassword: string;
  selfieUri: string;
  dateOfBirth: string;
  gender: GenderOption | null;
}

export interface LoginData {
  email: string;
  password: string;
}