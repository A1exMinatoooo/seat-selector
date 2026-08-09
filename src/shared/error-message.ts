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
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  INTERNAL_ERROR: "系统暂时遇到问题，请稍后重试。",
};

export function userFacingErrorMessage(code: string | undefined): string {
  return (code && messages[code]) ?? "操作失败，请稍后重试。";
}

export async function responseErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return userFacingErrorMessage(body.error);
}
