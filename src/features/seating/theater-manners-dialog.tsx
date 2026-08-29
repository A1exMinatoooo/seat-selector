"use client";

import Image from "next/image";
import { useEffect } from "react";

const theaterManners = [
  { icon: "/assets/images/theater-manner/phone-off.png", text: "请将手机调至静音或震动状态，并调低亮度" },
  { icon: "/assets/images/theater-manner/no-recording.png", text: "龙标出现至结尾字幕结束，禁止录音/拍照/摄像" },
  { icon: "/assets/images/theater-manner/no-talking.png", text: "观影途中请保持安静，不要大声喧哗" },
  { icon: "/assets/images/theater-manner/no-late-entry.png", text: "请预留充足时间提前到场，避免在正片开始后入场" },
  { icon: "/assets/images/theater-manner/no-seat-pushing.png", text: "请勿踢碰或推挤前排座椅" },
] as const;

export function TheaterMannersDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3_000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="lottery-backdrop theater-manners-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theater-manners-title"
      aria-describedby="theater-manners-description"
    >
      <div className="lottery-modal theater-manners-modal">
        <header className="theater-manners-heading">
          <p className="eyebrow">观影礼仪</p>
          <h2 id="theater-manners-title">文明观影须知</h2>
          <p id="theater-manners-description">请共同维护安全、舒适的观影环境</p>
        </header>
        <ul className="theater-manners-list">
          {theaterManners.map((item) => (
            <li key={item.icon}>
              <Image src={item.icon} width={180} height={180} alt="" />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
        <button
          className="button primary theater-manners-confirm"
          type="button"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
    </div>
  );
}
