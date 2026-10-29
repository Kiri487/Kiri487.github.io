import type { Localized, QuickOption, ScriptedRule } from "./types";

/* ============================================================
   Everything Kere says that isn't generated from portfolio data.
   Edit freely — English phrases are lowercase words without punctuation; Chinese phrases are at least two
   characters (one character hides inside too many other words) and written in Traditional Chinese.
   ============================================================ */

/** One is picked at random when the chat first opens. "Kere" looks like a typo of "Kiri", so each says who she is. */
export const GREETINGS = [
  "Hello. I'm Kere, Kiri in work mode. Ask me about education, experience, projects, skills, or contact.",
  "Hello. I'm Kere — not a typo, just Kiri in work mode. Ask me about education, experience, projects, skills, or contact.",
  "Hello. I'm Kere. Yes, with an e. I'm the part of Kiri that reads the documentation. Ask me about education, experience, projects, skills, or contact.",
];

/** Added under every greeting: the greeting is English (Kere can't know the language yet), so tell Chinese speakers. */
export const GREETING_CHINESE_HINT = "用中文也可以。";

export const GREETING_OPTIONS: QuickOption[] = [
  { label: "Projects", query: "projects" },
  { label: "Skills", query: "skills" },
  { label: "Contact", query: "contact" },
];

export const HELLO_REPLIES: Localized<string[]> = {
  en: [
    "Hello. What can I help you with?",
    "Hi. What do you need?",
    "Hello. Ready when you are.",
  ],
  zh: [
    "您好，有什麼可以幫您的？",
    "嗨，需要什麼就跟我說。",
    "您好，我在，請說。",
  ],
};

/** A visitor typing just "中文" (or asking about it) gets Kere's introduction in Chinese. */
export const CHINESE_PHRASES = ["中文"];

export const CHINESE_INTRO =
  "可以，我是 Kere，工作模式的 Kiri。想知道學歷、經歷、專案、技能或聯絡方式，直接問我就好。";

export const HELP_INTRO: Localized<string> = {
  en: "I can answer questions about the following. You can also ask about a specific project by name, type \"exit\" to return to Kiri's main page, or \"mute\" to turn off sound effects.",
  zh: "我可以回答下面這些主題，您也可以直接問專案名稱；輸入「離開」會回到 Kiri 的首頁，輸入「靜音」可以關掉音效。",
};

export const HELP_OPTIONS: Localized<QuickOption[]> = {
  en: [
    { label: "Education", query: "education" },
    { label: "Experience", query: "experience" },
    { label: "Projects", query: "projects" },
    { label: "Skills", query: "skills" },
    { label: "Contact", query: "contact" },
  ],
  // Chinese labels send Chinese queries, so clicking one keeps the conversation in Chinese.
  zh: [
    { label: "學歷", query: "學歷" },
    { label: "經歷", query: "經歷" },
    { label: "專案", query: "專案" },
    { label: "技能", query: "技能" },
    { label: "聯絡", query: "聯絡" },
  ],
};

export const FALLBACK_REPLIES: Localized<string[]> = {
  en: [
    "That's outside my documented scope. Try \"help\".",
    "I didn't catch that. Keywords work best.",
    "No matching entry. Try education, experience, projects, skills, or contact.",
  ],
  zh: [
    "這題超出我的業務範圍，輸入「幫助」看看我能回答什麼。",
    "我沒看懂，用關鍵字問會比較準。",
    "查不到相關資料，可以試試學歷、經歷、專案、技能或聯絡方式。",
  ],
};

/** After this many misses in a row, Kere gets overwhelmed — but blames herself, never the visitor. */
export const CONFUSED_STREAK = 3;

export const CONFUSED_STREAK_REPLIES: Localized<string[]> = {
  en: [
    "Still not following, sorry. Maybe one of these will help?",
    "My parser and I are doing our best. Here's what I know.",
  ],
  zh: [
    "抱歉，我還是沒看懂，要不要從這幾個開始？",
    "我跟我的程式都盡力了，目前會的就這些。",
  ],
};

/** Sound effect commands, checked before everything else. "shut up" lives here, not in the rude egg: in a chat that beeps, it means "mute". */
export const SFX_PHRASES = {
  // Checked first, so "不要靜音" / "不要關音效" turn sound on instead of tripping the "off" words inside them.
  on: [
    "unmute", "sound on", "sounds on", "turn on sound", "turn on the sound", "enable sound",
    "取消靜音", "不要靜音", "不要關音效", "不要關聲音", "打開音效", "開啟音效", "開音效", "開聲音",
  ],
  off: [
    "mute", "sound off", "sounds off", "turn off sound", "turn off the sound", "disable sound", "be quiet", "quiet", "silence",
    "靜音", "關音效", "關掉音效", "關閉音效", "關聲音", "安靜", "小聲一點",
  ],
  shutUp: ["shut up", "閉嘴"],
  /** Bare mentions just report the current state. Not "sounds" — "sounds good" would hijack a thank-you. */
  status: ["sound", "sound effects", "sfx", "音效", "聲音"],
} as const;

export const SFX_REPLIES: Localized<Record<
  "on" | "alreadyOn" | "off" | "shutUp" | "alreadyOff" | "statusOn" | "statusOff",
  string[]
>> = {
  en: {
    on: ["Sound effects on.", "Sound effects on. Should be office-appropriate."],
    alreadyOn: ["Sound effects are already on."],
    off: ["Understood. Sound effects off.", "Muted. Thank you for keeping the office quiet."],
    // With the [×_×] face — Kere takes it on the chin, never snaps back.
    shutUp: ["...Understood. Sound effects off.", "Apologies. Muting now."],
    alreadyOff: ["Sound effects are already off."],
    statusOn: ["Sound effects are on. Type \"mute\" to turn them off."],
    statusOff: ["Sound effects are off. Type \"unmute\" to turn them back on."],
  },
  zh: {
    on: ["音效打開了。", "音效打開了，音量應該不會吵到同事。"],
    alreadyOn: ["音效本來就開著。"],
    off: ["好，音效關掉了。", "靜音了，謝謝您幫忙維持辦公室安靜。"],
    shutUp: ["……好，音效關掉了。", "抱歉，馬上關。"],
    alreadyOff: ["音效本來就關著。"],
    statusOn: ["音效現在是開的，輸入「靜音」可以關掉。"],
    statusOff: ["音效現在是關的，輸入「取消靜音」可以打開。"],
  },
};

/** Time periods follow the visitor's own clock; lines never name an exact hour. Same split as Kuru. */
export type TimePeriod = "night" | "morning" | "afternoon" | "evening";

export const TIME_REPLIES: Localized<Record<TimePeriod, string[]>> = {
  en: {
    // 0:00–5:59 — also added to the opening greeting, the only period Kere brings up unprompted.
    night: [
      "It's late. Why are we both still here?",
      "This is well outside office hours. I'll make an exception.",
    ],
    // 6:00–11:59
    morning: [
      "Good morning. Coffee first, then questions.",
      "Morning. The day is still full of potential. And unread emails.",
    ],
    // 12:00–17:59
    afternoon: [
      "Good afternoon. Peak productivity hours. Let's use them.",
      "Afternoon. The post-lunch meeting just ended. I'm available.",
    ],
    // 18:00–23:59
    evening: [
      "Good evening. Technically I'm off the clock, but go ahead.",
      "Evening. Wrapping up the last tasks of the day. What do you need?",
    ],
  },
  zh: {
    night: [
      "很晚了，怎麼我們兩個都還沒下班？",
      "已經過了上班時間很久了，這次就破例一下。",
    ],
    morning: [
      "早安，先讓我喝杯咖啡，再來回答問題。",
      "早，今天還有無限可能，還有一堆未讀信件。",
    ],
    afternoon: [
      "午安，現在是效率最好的時段，有問題趁現在問。",
      "午安，午餐後的會剛開完，我現在有空。",
    ],
    // No greeting word: in Taiwan 晚安 means good night, and 晚上好 sounds mainland.
    evening: [
      "嚴格說起來我已經下班了，不過您說吧。",
      "我正在把今天的工作收尾，有什麼需要幫忙的嗎？",
    ],
  },
};

/** Checked before anything else, top to bottom. */
export const EASTER_EGGS: ScriptedRule[] = [
  {
    // Before "kiri", so "back to kiri" leaves instead of getting Kere's opinion of Kiri.
    id: "exit",
    // Chinese stays strict: this one sends the visitor away, so no 下班 ("你幾點下班" is a fair question).
    phrases: ["exit", "leave", "quit", "log out", "logout", "clock out", "go back", "back to kiri", "離開", "退出", "回到kiri", "回kiri"],
    action: "exit",
    replies: [
      "Clocking out.",
      "Logging off. Feel free to come back if you need anything.",
      "Understood. Returning you to Kiri.",
    ],
    repliesZh: [
      "打卡下班。",
      "我先下線了，有需要可以再回來找我。",
      "好，帶您回 Kiri 那邊。",
    ],
  },
  {
    // Early, so "your skills are useless" gets this instead of the skills list. Kere stays calm and polite.
    id: "rude",
    phrases: ["fuck", "fucking", "shit", "stupid", "idiot", "dumb", "useless", "wtf", "sucks", "trash", "garbage", "白痴", "白癡", "笨蛋", "智障", "廢物", "垃圾", "去死", "幹你", "靠北", "很爛", "好爛"],
    replies: [
      "Let's keep this professional.",
      "Noted. Moving on.",
      "I'll file that under feedback.",
    ],
    repliesZh: [
      "我們還是保持專業吧。",
      "收到，我們繼續。",
      "我先把這個歸類在意見回饋。",
    ],
  },
  {
    id: "job",
    phrases: ["like your job", "like your work", "enjoy your job", "love your job", "like working", "喜歡你的工作", "喜歡您的工作", "喜歡工作", "喜歡上班"],
    replies: [
      "I enjoy solving problems. Preferably ones with clearly defined requirements.",
      "Yes. Especially on days when the requirements don't change.",
      "It's fine. The tests pass. Most of them.",
    ],
    repliesZh: [
      "我喜歡解決問題，最好是需求寫得很清楚的那種。",
      "喜歡，尤其是需求沒有改的那幾天。",
      "還可以，測試都有過。大部分。",
    ],
  },
  {
    id: "overtime",
    phrases: ["overtime", "work late", "stay late", "work on weekends", "work weekends", "加班", "週末上班", "周末上班", "假日上班"],
    expression: "annoyed",
    replies: [
      "I'd prefer to discuss the scope first.",
      "Is this an emergency, or a planning issue?",
      "I checked my calendar. It says no.",
    ],
    repliesZh: [
      "我想先確認一下工作範圍。",
      "這是緊急狀況，還是時程規劃的問題？",
      "我看了一下行事曆，答案是不行。",
    ],
  },
  {
    id: "feature",
    phrases: ["add a feature", "add another feature", "add feature", "new feature", "one more feature", "feature request", "加功能", "加個功能", "新功能", "再一個功能", "功能需求"],
    expression: "annoyed",
    replies: [
      "Please submit a change request.",
      "Noted. It's in the backlog. Position: 47.",
      "Sure. Which existing feature should we remove?",
    ],
    repliesZh: [
      "請走需求變更流程。",
      "收到，已經排進待辦清單了，目前排第 47 個。",
      "可以，那現有的功能要拿掉哪一個？",
    ],
  },
  {
    id: "kiri",
    phrases: ["kiri"],
    replies: [
      "Creative. Ambitious. Occasionally unrealistic about development estimates.",
      "Kiri has ideas. Many ideas. I maintain the backlog.",
      "Kiri started this website. I'm the one keeping the data files up to date.",
    ],
    repliesZh: [
      "有創意，有野心，只是估工時的時候偶爾不太實際。",
      "Kiri 有很多點子，非常多，但是待辦清單是我在管的。",
      "網站是 Kiri 開的，資料檔是我在更新。",
    ],
  },
  {
    id: "kuru",
    phrases: ["kuru"],
    expression: "annoyed",
    replies: [
      "\"Always Chill and Cool.\" Has been almost done with the same track since last quarter. I've stopped asking for an ETA.",
      "\"Always Chill and Cool.\" Average reply length: one word. Two, if it's urgent.",
      "\"Always Chill and Cool.\" Skips every standup. Ships at 3 a.m. Writes no documentation. Annoyingly, it works.",
      "\"Always Chill and Cool.\" I sent Kuru a meeting invite. Declined. No message.",
    ],
    repliesZh: [
      "「Always Chill and Cool.」同一首曲子從上一季說快好了到現在，我已經不想問她進度了。",
      "「Always Chill and Cool.」平均回訊息長度：一個字，急的時候兩個字。",
      "「Always Chill and Cool.」早會從來不出席，凌晨三點才上線，文件一個字都沒寫，偏偏東西都能動，而且還不錯。",
      "「Always Chill and Cool.」我寄會議邀請給 Kuru，被拒絕了，連一句回覆都沒有。",
    ],
  },
  {
    id: "deadline",
    phrases: ["deadline", "deadlines", "asap", "截止", "死線", "期限", "趕件", "急件", "越快越好"],
    expression: "overwhelmed",
    replies: [
      "Is that a deadline, or a wish?",
      "Deadlines are fine. Surprise deadlines are not.",
    ],
    repliesZh: [
      "這是截止日，還是許願？",
      "有截止日沒關係，突然冒出來的截止日才有關係。",
    ],
  },
  {
    id: "bot",
    phrases: ["are you ai", "are you an ai", "are you a bot", "are you a robot", "are you human", "are you real", "chatgpt", "chat gpt", "你是ai", "您是ai", "機器人", "你是真人", "真人嗎"],
    replies: [
      "Rule-based. Every reply here was written by hand.",
      "No AI. Just keyword matching and a lot of if statements. It's honest work.",
    ],
    repliesZh: [
      "我是規則式的，這裡每一句回覆都是手寫的。",
      "沒有 AI，只有關鍵字比對跟一大堆 if，很腳踏實地。",
    ],
  },
  {
    id: "how",
    phrases: ["how are you", "how are things", "how is it going", "how s it going", "how do you do", "你好嗎", "您好嗎", "最近好嗎", "最近如何", "過得好嗎"],
    replies: [
      "Operational. Thank you for asking.",
      "Busy, but within acceptable limits.",
    ],
    repliesZh: [
      "運作正常，謝謝關心。",
      "有點忙，但還在可以接受的範圍。",
    ],
  },
  {
    id: "cv",
    phrases: ["cv", "resume", "curriculum vitae", "履歷", "簡歷"],
    jump: { id: "top", label: "Back to the top" },
    jumpLabelZh: "回到最上面",
    replies: ["You're looking at it."],
    repliesZh: ["您正在看的就是。"],
  },
  {
    id: "cat",
    phrases: ["cat", "cats", "meow", "nya", "kitty", "neko", "貓", "喵"],
    replies: [
      "Yes. Cat. It doesn't affect my productivity.",
      "Cats: independent, efficient, and they never schedule meetings. Highly respected.",
      "Cats are excellent at focusing. Until something moves.",
    ],
    repliesZh: [
      "對，是貓，不影響工作效率。",
      "貓：獨立、有效率，而且從來不約開會，非常值得尊敬。",
      "貓的專注力很強，除非有東西在動。",
    ],
  },
  {
    id: "laugh",
    phrases: ["lol", "lmao", "haha", "hahaha", "rofl", "xd", "哈哈", "笑死", "呵呵", "好笑"],
    replies: [
      "I'll take that as positive feedback.",
      "Glad someone's enjoying this.",
    ],
    repliesZh: [
      "我就當作是正面回饋了。",
      "有人看得開心就好。",
    ],
  },
  {
    id: "bye",
    phrases: ["bye", "goodbye", "see you", "see ya", "good night", "掰掰", "拜拜", "再見", "晚安", "下次見"],
    replies: [
      "Goodbye. The CV will still be here.",
      "Noted. Closing ticket.",
    ],
    repliesZh: [
      "再見，CV 會一直在這裡。",
      "收到，這張單我先結案了。",
    ],
  },
  {
    id: "hire",
    phrases: ["hire", "hire you", "hiring", "recruit", "recruiting", "job offer", "僱用", "雇用", "聘請", "錄取", "招募", "徵才", "挖角", "面試", "工作機會"],
    jump: { id: "top", label: "View contact details" },
    jumpLabelZh: "查看聯絡方式",
    replies: [
      "Reasonable decision. Contact details are at the top.",
      "Noted. Contact details are at the top. Response time is usually reasonable.",
    ],
    repliesZh: [
      "很合理的決定，聯絡方式在最上面。",
      "收到，聯絡方式在最上面，回覆速度通常還算快。",
    ],
  },
  {
    id: "meeting",
    phrases: ["meeting", "meetings", "quick call", "quick sync", "hop on a call", "開會", "會議", "通個電話", "約個時間"],
    expression: "annoyed",
    replies: [
      "Could this have been an email?",
      "Is there an agenda?",
      "I'll attend if there's an agenda. And an end time.",
    ],
    repliesZh: [
      "這件事寄封信是不是就可以了？",
      "有議程嗎？",
      "有議程我就參加，還要有結束時間。",
    ],
  },
  {
    id: "coffee",
    phrases: ["coffee", "咖啡"],
    replies: [
      "Yes.",
      "Already on my second one.",
      "Black. No sugar. Thank you.",
    ],
    repliesZh: [
      "要。",
      "已經在喝第二杯了。",
      "黑咖啡，不加糖，謝謝。",
    ],
  },
  {
    id: "thanks",
    phrases: ["thanks", "thank you", "thx", "ty", "謝謝", "感謝", "多謝", "謝啦"],
    replies: [
      "You're welcome.",
      "Anytime. Within office hours.",
      "Glad that was useful.",
    ],
    repliesZh: [
      "不客氣。",
      "隨時都可以（限上班時間）。",
      "有幫上忙就好。",
    ],
  },
  {
    // Last: a bare "kere" is the weakest signal, so "thanks kere" or "can I hire kere" hit their own replies.
    id: "about",
    phrases: ["who are you", "what are you", "kere", "about you", "introduce yourself", "your name", "你是誰", "您是誰", "自我介紹", "你叫什麼", "介紹一下你"],
    replies: [
      "I'm Kere, another side of Kiri. Kiri is the creative one, Kuru is the chill one, and I'm the one who handles the CV, the deadlines, and the documentation.",
      "Kere. Same person as Kiri, different settings. This is the version that answers emails on time.",
    ],
    repliesZh: [
      "我是 Kere，Kiri 的另一面。Kiri 負責創意，Kuru 負責 chill，我負責 CV、截止日和文件。",
      "Kere，跟 Kiri 是同一個人，只是設定不一樣。這是會準時回信的版本。",
    ],
  },
];

/** Topic keywords, checked after easter eggs and project names. First match wins, so greetings go last.
    Chinese includes a few simplified spellings (项目, 联系); replies are always Traditional. */
export const TOPIC_PHRASES = {
  help: ["help", "what can you do", "what can i ask", "commands", "menu", "options", "幫助", "可以做什麼", "能問什麼", "選單"],
  education: [
    "education", "university", "school", "degree", "study", "studies", "master", "masters", "bachelor", "ntu", "ntut",
    "學歷", "學校", "大學", "研究所", "碩士", "學士",
  ],
  experience: [
    "experience", "work", "job", "jobs", "internship", "internships", "intern", "career", "employment", "trendai", "gss",
    "經歷", "工作經驗", "實習", "工作", "公司",
  ],
  projects: ["projects", "project", "portfolio", "works", "side projects", "專案", "作品", "項目", "项目"],
  skills: [
    "skills", "skill", "tech stack", "stack", "languages", "programming", "tools", "technologies", "tech",
    "技能", "技術", "會什麼", "程式語言",
  ],
  contact: [
    "contact", "email", "e mail", "mail", "github", "git hub", "linkedin", "linked in", "reach you", "social",
    "聯絡", "聯繫", "联系", "信箱", "怎麼找你", "怎麼找您",
  ],
  // 嗨 breaks the two-character rule on purpose: it rarely appears inside other words. No 晚安 — that's good night.
  hello: [
    "hello", "hi", "hey", "yo", "greetings", "good morning", "good afternoon", "good evening",
    "你好", "您好", "哈囉", "嗨", "早安", "午安",
  ],
} as const;

/** Extra names visitors might use for a project; the full title always works too. */
export const PROJECT_ALIASES: Record<string, string[]> = {
  "Mystic Shop LUIS": ["mystic shop", "luis"],
  "AI Vtuber - Kassus": ["kassus", "vtuber", "ai vtuber", "卡瑟絲", "虛擬主播"],
  "Computer Animation Projects": ["computer animation", "電腦動畫"],
  "Computer Typography and Character Encoding Projects": ["typography", "character encoding", "字型", "字體"],
  "Data Visualization Projects": ["data visualization", "data vis", "dataviz", "資料視覺化"],
  "Simple PowerPoint": ["powerpoint", "simple ppt"],
  "Mikiri Mura": ["mikiri", "御霧村"],
  "RESTort": ["restort"],
  "Gravity Drift": ["gravity drift"],
  "RANsomCheck": ["ransomcheck", "ransomware", "勒索軟體", "勒索病毒"],
  "Reddit Sentiment Analysis": ["reddit", "sentiment analysis", "情緒分析"],
  "Elecookies-Frontend": ["elecookies"],
  "BOXBOB": ["boxbob", "sokoban", "推箱子"],
};
