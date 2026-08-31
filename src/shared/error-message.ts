const messages: Record<string, string> = {
  UNAUTHORIZED: "登录状态已失效，请重新登录。",
  FORBIDDEN: "当前操作没有权限，或二维码已经失效。",
  VALIDATION_ERROR: "提交的信息有误，请检查后重试。",
  NOT_FOUND: "找不到要访问的内容。",
  SEAT_CONFLICT: "部分座位已被他人确认，请重新选择。",
  EVENT_CONFLICT: "活动状态已发生变化，请刷新页面后重试。",
  LOCATION_REQUIRED: "需要通过现场定位验证后才能继续。",
  DEVICE_ALREADY_BOUND: "该参与者已绑定其他设备，请联系管理员解绑。",
  IDENTITY_MISMATCH: "没有找到匹配的参与者，请检查输入信息。",
  IDENTITY_CANDIDATE_INVALID: "身份选项已失效，请重新输入信息。",
  LOTTERY_UNAVAILABLE: "抽奖暂时不可用，已完成的结果不会重复抽取。",
  TICKET_ISSUE_EXPIRED: "二维码已过期，请让发起者重新发行。",
  TICKET_ISSUE_CLAIMED: "二维码已被领取或失效，请让发起者重新发行。",
  TICKET_ISSUE_CAPACITY_EXCEEDED: "预计可抽奖票数额度不足，请调整活动设置。",
  TICKET_ISSUE_SELECTION_EXISTS: "本设备已完成选座，不能再次领取。",
  SELECTION_ALREADY_COMPLETED: "您已完成本场选座。",
  CONSECUTIVE_WORKFLOW_ACTIVE: "本设备已有进行中的连签，请先完成或等待现场工作人员撤销。",
  CONSECUTIVE_WORKFLOW_EXPIRED: "本次连签已超时，请让现场工作人员重新发行。",
  CONSECUTIVE_WORKFLOW_UNAVAILABLE: "连签活动状态已变化，请联系现场工作人员。",
  CONSECUTIVE_SEAT_HELD: "部分座位正在被其他参与者选择，请重新选择。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  INTERNAL_ERROR: "系统暂时遇到问题，请稍后重试。",
  NETWORK_ERROR: "网络连接失败，请检查网络后重试。",
};

export function userFacingErrorMessage(code: string | undefined): string {
  return (code && messages[code]) ?? "操作失败，请稍后重试。";
}

export async function responseErrorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return userFacingErrorMessage(body.error);
}
