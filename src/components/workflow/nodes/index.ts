import { TriggerNode } from "./TriggerNode";
import { ActionNode } from "./ActionNode";
import { ConditionNode } from "./ConditionNode";
import { DelayNode } from "./DelayNode";
import { UploadVideoNode } from "./UploadVideoNode";

export const nodeTypes = {
  trigger_manual: TriggerNode,
  trigger_schedule: TriggerNode,
  action_upload_video: UploadVideoNode,
  action_generate_video: ActionNode,
  action_create_shorts: ActionNode,
  action_publish_youtube: ActionNode,
  action_publish_instagram: ActionNode,
  action_publish_facebook: ActionNode,
  action_publish_snapchat: ActionNode,
  condition_if_else: ConditionNode,
  delay: DelayNode,
};
