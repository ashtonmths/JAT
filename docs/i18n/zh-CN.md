# 求职申请追踪器：简体中文（zh-CN）术语表

*The Simplified Chinese glossary and style rules every translation of this app follows (written in Chinese for its
translators; the table's first column is the English). How it's used: `docs/rfc/zh-cn.md`. To suggest a better term,
open an issue or a pull request.*

本文是 Job Application Tracker 界面简体中文（中国大陆）翻译的参考依据。所有译者都按这份术语表和下面的风格规则翻译，这样同一个概念在任何页面上都只有一种说法。英文原文在 `frontend/src/locales/en/*.ts`，源文件中的注释说明了每条文本的使用场景。翻译前请先读注释，并查阅 `docs/guide/using-the-app.md`，弄清每个功能的含义。

目标读者是在中国大陆求职的软件工程师，用这个应用管理自己的求职进度。这是一个运行在自己电脑上的私人工具，不是面向客户的服务。

## 风格

**称呼用"你"，不用"您"。** 这是用户写给自己的私人工具，现代中文产品（微信、飞书、各类开发者工具）面向个人用户时都用"你"。用"您"会显得像客服在说话，与英文原文平实、直接的语气不符。全文统一，不能混用。

**语气。** 简洁、口语化、友好，像做得好的国产软件那样，不按英文逐字直译。不加"请"（例如"请输入公司"直接写"输入公司"或"哪家公司？"）。不用感叹号，原文有感叹号的除外（例如 `Coming soon!`）。

**按钮与操作。** 用动词开头的短语，尽量控制在 2 到 6 个字：保存、删除、新建申请、添加轮次、标为完成。按钮末尾不加标点。英文中固定的动词对应如下：
- Add：添加
- New（新建一项）：新建
- Create：创建
- Edit：编辑
- Save：保存
- Cancel：取消
- Delete：删除（永久删除数据）
- Remove：移除（只解除关联，数据仍在）。Delete 和 Remove 必须区分。
- Undo：撤销
- Open：打开
- Log（记录一条动态）：记录

**屏幕阅读器文本**（注释中写有 "read out by screen readers" 或 `…Label` 的键）。写成完整、自然的句子，带句末标点，例如 `"{{card}} 已放到 {{column}}。"`。屏幕阅读器句子里的列名（`{{column}}`、`{{title}}`）不加引号；屏幕上可见的句子里出现列名时可以加 “”（例如 `board.dropOnNoRound`）。 针对某一项的屏幕阅读器标签写成“动作：{{label}}”（例如 `更多操作：{{label}}`），不写成“{{label}} 的动作”，因为 {{label}} 里可能已有冒号或很长的用户文字。

**标点。**
- 句子里一律使用全角标点：，。：；？！（）。
- 中文引号用 “”，不用「」或 ""。界面中出现的阶段名、按钮名如果嵌在句子中间，用 “” 括起来（见下文“占位符”一节）。
- 句子内的并列项用顿号“、”。`listJoiner` 一类的连接符（英文为 `", "`）译为 `"、"`。
- 省略号：英文用单个字符 “…” 的地方保留单个 “…”（例如 `移至…`、`搜索公司、职位、招聘顾问…`）。只有在完整句子中确实需要表达省略时才用 “……”。
- 分隔符键（注释中标明是 separator，或值是 `" · "` 这类分隔符）分两种：
  - 标点连接符（英文为 `"; "`、`", "`）改成全角中文标点，后面不加空格：`"; "` 译为 `"；"`（例如 `uploadFailedSeparator`、`validation.separator`），`", "` 译为 `"、"`（例如 `listJoiner`、`validation.fieldSeparator`）。
  - 视觉分隔符（`" · "`、`"–"`、`"→"`）原样保留，不翻译，也不改空格：`" · "`、`"<line/> · <person/>"`、`"{{from}}–{{to}}"`。
- 冒号：标签后面用全角 “：”，冒号后面不加空格，例如 `"<b>渠道：</b><route/>"`、`"<b>投递日期：</b>{{date}}"`。
- 箭头 `→`、`×`、`%` 原样保留。`×` 只在单独作符号时保留；英文把 `×` 接在次数后面（"sent {{times}}×"）时，用量词“次”（“已发送 {{times}} 次”）。
- 演示输入格式的占位示例（例如标签输入框的 `python, fintech, remote…`）保留英文半角逗号，因为输入框可能按半角逗号拆分。示例里的词可以译，例如 `python, 金融科技, 远程…`。

**中文与数字、拉丁字母之间的空格。** 采用现代中国大陆界面的通行做法：中文与阿拉伯数字、拉丁字母之间加一个半角空格。
- `第 2 轮`、`{{count}} 天前`、`简历 v3`、`IR35 范围外`、`用 Markdown 书写`、`已获 Offer`。
- 中文字符之间不加空格。全角标点前后不加空格。数字与 `%`、货币符号之间不加空格。
- 占位符一律当作拉丁字母或数字处理：与相邻中文之间加一个空格（`{{count}} 天`、`与 {{name}} 通话`、`{{company}} 的 {{role}}`）。占位符紧挨全角标点、引号或 `·` 分隔符时，不再加空格。日期占位符（`{{date}}`、`{{when}}`、`{{at}}`）例外：应用插入的是“2026年10月12日”这样以汉字结尾的中文日期，所以后面紧跟中文时不加空格（`{{date}}前`、`{{date}}发送`）；但插入的若是日期加时间（formatDateTime，如“2026年11月7日 21:10”），结尾是数字，后面照常加空格（`{{when}} 截止`）；前面是中文时照常加空格（`投递于 {{date}}`），因为日期以数字开头。
- 例外是阶段名：`{{stage}}`、`{{what}}`、`{{to}}` 这类会渲染成中文阶段名的占位符，在句子中间用 “” 括起来，不加空格，例如 `移至“{{stage}}”`、`将 {{company}} 标为“{{stage}}”`。在只有占位符和分隔符的短标签里（例如看板列标题 `{{stage}} · 第 {{round}} 轮`、时间线 `{{from}} → {{to}}`），保持原样，不加引号。

**占位符与标签。**
- `{{placeholder}}` 必须原样保留，名称不能改动。可以按中文语序移动位置。
- `<b>…</b>`、`<guide>…</guide>`、`<1>…</1>` 这类标签原样保留，只翻译标签之间的文字。
- `<person/>`、`<agency/>`、`<route/>` 这类自闭合标签代表应用插入的链接或内容，原样保留，可以移动位置。
- 用户数据（公司名、人名、职位名、自定义阶段名、标签）不翻译，也不要放进翻译文本。

**复数。** 中文只有一种形式。只翻译 `_other` 键（`_one` 键如果存在，内容与 `_other` 相同），写成自然的中文，例如 `"{{count}} 天"`、`"{{count}} 位联系人"`。量词要正确：人用“位”，申请用“份”，轮次用“轮”，次数用“次”，天数用“天”，项目用“项”或“个”。

**日期、时间和金额。** `{{date}}`、`{{when}}`、`{{at}}`、`{{amount}}`、`{{rate}}`、`{{size}}` 都由应用按 zh-CN 区域格式化后插入，例如“2026年10月12日”“£650”。译文不要另加“年”“月”“日”“号”或货币单位，只翻译周围的文字。例如 `"Applied on {{date}}"` 译为 `"{{date}}投递"`，`"{{rate}} a day"` 译为 `"{{rate}}/天"`。

**相对时间**（`common.time`）。`今天`、`昨天`、`明天`、`{{count}} 天前`、`{{count}} 天后`、`{{count}} 周前`、`{{count}} 个月前`、`今天到期`、`已逾期 {{count}} 天`。“今天”作为相对时间时用“今天”，作为页面名时用“今日”（见术语表）。

**大写。** 部分标题和标记用 CSS 转成大写，会把“Offer”显示成“OFFER”。这是布局问题（路线图任务 `i18n-zh-cn-layout`），不要在译文里绕开，照常写“Offer”。

**命令与代码。** 反引号中的命令（`jat init`、`uv run jat serve`）、文件名、`config.toml`、`schema` 等技术词原样保留。

**虚构示例名。** 占位示例中的虚构公司名和人名（Contoso、Northwind Talent、Riley Chen、Alex Morgan）保留英文原样。示例句子要翻译。

## 术语表

| English | 中文 | Notes |
|---|---|---|
| Job Application Tracker | 求职申请追踪器 | 应用名称 |
| application | 申请 | 名词，指求职的一条记录。量词用“份”。“New application”译为“新建申请”，“Applications”页面名译为“申请” |
| apply / applied (verb) | 投递 | “Applied on”译为“投递日期”，“How did you apply?”译为“你是怎么投递的？” |
| role | 职位 | 公司里的某个岗位，投递前也可以单独存在。“Roles”页面名译为“职位” |
| job title | 职位名称 | |
| job ad / job ad link | 招聘信息 / 职位链接 | |
| job description | 职位描述 | 不写“JD” |
| company | 公司 | |
| agency | 猎头公司 | 指招聘中介 |
| recruiter | 招聘顾问 | 通称，包括猎头顾问和企业内部招聘人员。“Recruiters”页面名译为“招聘顾问” |
| Recruiter (agency) (relation) | 猎头顾问 | 联系人与申请的关系 |
| Internal recruiter / talent | 企业招聘 / 人才负责人 | |
| in-house recruiter | 企业内部招聘人员 | 指人时用“企业内部招聘人员”（如人员列表、“如果有企业内部招聘人员……联系过你”）；单独的“企业内部招聘”读作招聘这项工作，不是人 |
| hiring manager | 用人经理 | 不译为“招聘经理” |
| interviewer | 面试官 | |
| referrer | 内推人 | |
| person / people / contact | 联系人 | “People and companies”导航组译为“联系人与公司”，“New person”译为“新建联系人”，“Unknown contact”译为“未知联系人”；没有公司时写“未知公司”（不用单独的“?”） |
| route | 渠道 | 申请的来源方式，“Any route”译为“全部渠道” |
| Direct (route label) | 直投 | 列表和卡片上的短标签 |
| Directly / Applied directly | 直接投递 | 在表单和句子中使用 |
| Through a recruiter / Through an agency | 通过猎头 | “Through <person/> at <agency/>”译为“通过 <agency/> 的 <person/>” |
| Recruiter / Agency (route label) | 猎头 | 筛选器和列表中的渠道值 |
| Referral | 内推 | |
| stage | 阶段 | “All stages”译为“全部阶段”，“Show closed stages”译为“显示已结束的阶段” |
| closed (stage) | 已结束 | |
| active | 进行中 | “Active applications by stage”译为“进行中的申请（按阶段）” |
| Interested (stage, role action) | 感兴趣 | |
| Applied (stage, role status) | 已投递 | |
| Screen (stage) | 初筛 | |
| Interviewing (stage) | 面试中 | |
| Final (stage) | 终面 | |
| Offer (stage) | 已获 Offer | |
| Accepted | 已接受 | |
| Declined | 已婉拒 | 指你拒绝了 offer。与 Rejected 必须区分 |
| Rejected | 未通过 | 指对方拒绝了你 |
| Withdrawn | 已撤回 | 指你撤回了申请 |
| Ghosted | 已失联 | 阶段名和联系人标记共用这个词。“Not a ghost”译为“并未失联”，“(ghosted)”译为“（已失联）” |
| Not interested (person mark) | 不感兴趣 | |
| round | 轮 / 轮次 | 带编号时写“第 {{round}} 轮”（例如 `第 {{round}} 轮 · {{what}}`）。“Add round {{round}}”译为“添加第 {{round}} 轮”。单独作名词时用“轮次” |
| No round yet | 尚无轮次 | |
| interview | 面试 | |
| interview kinds: Technical / Coding task / System design / Pairing / Behavioural / Onsite / Hiring manager | 技术面 / 编程作业 / 系统设计 / 结对编程 / 行为面试 / 现场面试 / 用人经理面 | Screen 和 Final 同阶段名，分别是“初筛”和“终面” |
| format: Video call / Phone / In person / Take-home | 视频通话 / 电话 / 当面 / 离线作业 | |
| call | 通话 | “Calls and meetings”译为“通话与会面”，“Book a call”译为“约通话”，“Log call”译为“记录通话” |
| meeting | 会面 | |
| Join link / Meeting link | 入会链接 / 会议链接 | |
| booked / not booked yet | 已预约 / 尚未预约 | |
| Happened / Didn't happen | 已进行 / 未进行 | |
| Reschedule / Rescheduled | 改期 / 已改期 | |
| Needs a new time | 待定新时间 | |
| who needed the change: you / they / you both / not down to either of you | 由你提出 / 由对方提出 / 双方共同提出 / 与双方无关 | 改期和待定新时间的原因都用这一组，与“提出方”一致。不要写“你需要改时间”或“你需要调整”，读起来像在吩咐用户 |
| No figures yet (an offer without pay) | 暂无金额 | |
| Set new time (button) | 设定新时间 | 其他提示文字引用这个按钮时用同样的词 |
| version label (a version's name, e.g. v3 (fintech)) | 版本名 | 不用“标签”（那是 tag）。字段名 Version 仍是“版本” |
| Record as sent (a document version) | 记为已发送 | 按钮、弹窗标题和提示里都用这个说法 |
| general note (attached to nothing) | 通用笔记 | 编辑器提示（留空即为通用笔记）和“笔记”页筛选（仅通用笔记）都用它 |
| Write / Preview (Markdown editor tabs) | 编写 / 预览 | Write 不是 Edit（编辑），编辑留给编辑按钮和弹窗标题 |
| Debrief | 复盘 | |
| Prep | 准备 | |
| Questions asked | 被问到的问题 | |
| Awaiting outcome | 等待结果 | |
| How did it go? | 聊得怎么样？（通话、会面之后） / 结果如何？（面试轮次之后） / 情况如何？（“今日”页同时列出面试和通话的分组标题） | 问的是已经结束的事，不用“进展如何”（那是问进行中的事）。“结果如何”只用于面试后的这个问题，复盘笔记的提示文字写“面试过程和感受”，不要让人以为在问通过与否 |
| offer | Offer | 中国大陆程序员的通用说法，保留拉丁字母，前后加空格。“Add offer”译为“添加 Offer” |
| Deciding (offer status) | 考虑中 | |
| revised offer | 更新后的 Offer | |
| Earlier offer (replaced by a revised one) | 之前的 Offer | |
| Received (the date an offer came in) | 收到日期 | 同“投递日期”“发送日期”的写法 |
| Length (a contract's or fixed term's) | 合同期限 | 表单里写“合同期限（月）”，数值写“{{count}} 个月” |
| Notes (an offer's own text field) | 备注 | 不是“笔记”（那是 Markdown 笔记功能） |
| Offers to answer | 待答复的 Offer | |
| Reply by | 答复截止 | “Reply by {{date}}”译为“{{date}}前答复” |
| salary / base salary / day rate | 薪资 / 基本工资 / 日薪 | “{{rate}} a day”译为“{{rate}}/天”，“{{amount}} a year”译为“{{amount}}/年” |
| bonus / equity / employer pension / holiday / benefits | 奖金 / 股权 / 雇主养老金 / 年假 / 福利 | |
| Worth a year | 年度总值 | |
| Start date | 入职日期 | |
| Permanent / Contract / Fixed term | 正式岗 / 合同工 / 固定期限 | |
| IR35 / Outside / Inside | IR35 / IR35 范围外 / IR35 范围内 | 英国税务规则名，不翻译。单独出现时（如卡片上的条目）带“IR35”；放在已标明 IR35 的标签下（表单选项、对比表的行）时只写“范围外 / 范围内 / 未知”。“Unknown”是“未知”，表单里“Not sure”这个选项写“不确定” |
| Remote / Hybrid / In office | 远程 / 混合办公 / 线下办公 | 英文为小写的场景（`line.workModes`）在中文里用同样的词 |
| track | 追踪 | 指记录和跟踪求职进展（与应用名称“求职申请追踪器”一致）。不要用“跟进”，那是 follow up |
| follow up | 跟进 | 指按计划日期跟进。“Follow up on {{date}}”译为“{{date}}跟进”，“Remind me to follow up”译为“提醒我跟进”。“跟进”分组里每行的“due {{date}}”也写“{{date}}跟进”，不写“截止”：那是计划日期，不是截止日期 |
| chase / chased | 催问 / 已催问 | 指在对方迟迟不回复时去问。“time to chase”译为“该催问了”，“{{count}} to chase”译为“{{count}} 份待催问”（数的是申请，量词用“份”） |
| Needs chasing | 待催问 | 用作筛选器和标记，与“跟进”区分 |
| Snooze / Snoozed until | 延后 / 延后至 | 与 Gmail 中文版一致 |
| Gone quiet / stale | 久无进展 | |
| reply to read / Replies to read | 待读回复 | 列表和卡片上的标记 |
| They've replied | 对方已回复 | |
| Read it | 已读 | |
| I've replied, waiting | 我已回复，等待中 | |
| Heard back | 已收到回复 | |
| Waiting to hear back | 等待回复 | |
| Waiting on them | 等待对方 | “今日”页的分组名 |
| Usually replies within {{count}} working days | 通常 {{count}} 个工作日内回复 | working day 译为“工作日” |
| archived / archive | 已归档 / 归档 | |
| Delete vs Remove | 删除 / 移除 | 删除是永久删除。移除只解除关联，数据仍在 |
| Merge | 合并 | |
| Favourite / star | 星标 | “Mark as a favourite”译为“加星标” |
| Pass (on a role) / Passed | 放弃 / 已放弃 | 与“已撤回”区分。“Reconsider”译为“重新考虑” |
| pitch / pitched (a recruiter putting a role to you) | 推荐 / 推荐的职位 | “{{person}} pitched {{role}} at {{company}}”译为“{{person}} 推荐了 {{company}} 的 {{role}}”；“Roles pitched or passed”译为“推荐或放弃的职位”；猎头公司页的标题“Roles through <agency>”译为“{{name}} 推荐的职位”，不用“通过 {{name}} 的职位” |
| To decide / Roles to decide | 待决定 / 待决定的职位 | |
| board | 看板 | “A column per interview round”译为“每个面试轮次一列” |
| list | 列表 | |
| column | 列 | 屏幕阅读器读出的 “{{title}} column” 译为“{{title}} 列” |
| card | 卡片 | |
| quick view | 快速预览 | 指抽屉面板 |
| Open full page | 打开完整页面 | |
| Move to… / Undo last move / Usual next | 移至… / 撤销上次移动 / 常规下一步 | |
| timeline | 时间线 | 页面名和卡片名都用这个词 |
| Lanes (timeline view) | 泳道 | |
| Log activity | 记录动态 | 动态类型：通话、邮件、消息、笔记 |
| to-do | 待办 | “Add a to-do”译为“添加待办”，“tick off”译为“勾选完成” |
| note | 笔记 | |
| document | 文档 | “Documents sent”译为“已发送的文档” |
| CV | 简历 | |
| cover letter | 求职信 | |
| version | 版本 | “v{{number}}”原样保留 |
| file / upload / link | 文件 / 上传 / 链接 | |
| tag | 标签 | |
| Today (page, nav) | 今日 | 相对时间“today”译为“今天” |
| Your move | 轮到你 | “今日”页的分组名 |
| Coming up | 即将进行 | 用作分组名，也用作轮次状态 |
| Recent activity / Last activity | 最近动态 / 最后动态 | |
| At a glance | 概览 | |
| Key dates | 关键日期 | |
| Needs attention / All caught up | 需要处理 / 全部处理完了 | |
| Due {{when}} / overdue | {{when}}截止 / 已逾期 | 截止日期。{{when}} 是日期加时间（以数字结尾）时写“{{when}} 截止”，带空格 |
| Insights | 洞察 | |
| Review (the menu heading over Insights and Timeline) | 回顾 | 指回头看求职过程，不是审核 |
| this machine / this computer | 本机 | 比“这台电脑”简短，是软件里的常用说法 |
| for {{count}} days (how long a state has lasted) / since today | 已持续 {{count}} 天 / 始于今天 | “今天开始”单独出现时会被读成“今天开始做” |
| Rejection feedback | 被拒反馈 | |
| Details | 详情 | |
| Search / Search everything | 搜索 / 全局搜索 | |
| How it works | 使用说明 | |
| Getting started | 快速上手 | |
| Local-first | 本地优先 | |
| Download a backup | 下载备份 | |
| Connected / API offline | 已连接 / API 离线 | |
| Language / dark mode / light mode | 语言 / 深色模式 / 浅色模式 | |
| (draft) | （草稿） | |
| Coming soon | 即将推出 | |
| Optional / (optional) | 可选 / （可选） | |
| Not yet / Not set / No date | 暂未 / 未设置 / 无日期 | “暂未”只用在动词前（暂未投递）。日期输入框里单独的 Not yet 占位文字要写出缺的动作，例如“投递日期”的占位写“尚未投递” |
| move along (a card advancing through rounds) | 推进 | 例如“随之推进”，不用“前移” |
| View (List/Board switch) | 视图 | Label of the segmented control that switches between List (列表) and Board (看板). |
| Picked up / drop (keyboard drag-and-drop) | 拿起 / 放下 | Used in screen-reader messages during keyboard dragging: 已拿起 {{card}}。, 按空格键放下, {{card}} 已放下。 |
| Sent on | 发送日期 | Date-field label, following the same pattern as 投递日期 (Applied on). In a line with a date, 'sent {{date}}' is written {{date}}发送 (no space: the date ends in 日). |
| As (relation of a contact to an application) | 身份 | Label of the relation select (面试官, 用人经理, 猎头顾问…). Also used in hints that mention 'the role chosen above' when it means this relation, not a job role (职位). |
| The whole picture (Insights tab and section) | 全貌 | “洞察”页的标签页名和区块标题用同一个词。不用“概览”（那是 At a glance） |
| Sankey diagram | 桑基图 | 屏幕阅读器标签写成“……的桑基图。”，例如“{{count}} 份申请……的桑基图。” |
| flow (a band in a Sankey diagram) | 流向 | 例如“悬停在某个阶段或流向上查看数字” |
| rejection (counted) | 被拒 | 计数时量词用“次”：“共被拒 {{count}} 次”“{{count}} 次被拒中，{{n}} 次……”。阶段名仍是“未通过” |
| Screen or interview (Insights measure) | 初筛或面试 | 列名、指标和说明文字都用它，由阶段名“初筛”组成 |
| How sure (confidence range for a rate) | 可信度 | 列名和说明文字用同一个词。区间写成“很可能在 {{low}}% 到 {{high}}% 之间（95% 区间）” |
| snapshot (automatic git backup of the data folder) | 快照 | Used across the backup errors (快照失败, 快照已关闭). Not the same as 下载备份 (Download a backup). |
| data repo (the data folder as a git repository) | 数据仓库 | As in common's delete hint (你数据仓库的 git 历史). The data directory or folder on its own stays 数据目录 / 数据文件夹. |
