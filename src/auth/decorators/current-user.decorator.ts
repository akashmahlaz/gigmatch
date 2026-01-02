import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserDocument } from '../../schemas/user.schema';

export const CurrentUser = createParamDecorator(
  (data: keyof UserDocument | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserDocument;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);
