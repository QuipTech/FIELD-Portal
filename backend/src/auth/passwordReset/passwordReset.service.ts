import { Injectable } from '@nestjs/common';
import { CognitoUserDirectoryService } from '../../users/cognitoUserDirectory.service';
import {
  classifyPasswordResetEligibility,
  PasswordResetEligibility,
} from './passwordResetEligibility';

@Injectable()
export class PasswordResetService {
  constructor(private readonly userDirectory: CognitoUserDirectoryService) {}

  // Cognito's email filter is an exact match, so also try the lower-cased
  // address someone may have signed up with.
  checkEligibility = async (
    email: string,
  ): Promise<PasswordResetEligibility> => {
    const trimmedEmail = email.trim();
    let users = await this.userDirectory.findUsers('email', trimmedEmail);
    const lowerCasedEmail = trimmedEmail.toLowerCase();
    if (users.length === 0 && lowerCasedEmail !== trimmedEmail) {
      users = await this.userDirectory.findUsers('email', lowerCasedEmail);
    }
    return classifyPasswordResetEligibility(users);
  };
}
