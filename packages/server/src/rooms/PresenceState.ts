import { Schema, MapSchema, type } from '@colyseus/schema';

export class OnlineUser extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type('boolean') inGame: boolean = false;
}

export class PresenceState extends Schema {
  @type({ map: OnlineUser }) users: MapSchema<OnlineUser> =
    new MapSchema<OnlineUser>();
}
