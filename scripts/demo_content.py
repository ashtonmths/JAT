"""The words in the demo data, one table per language; `seed_demo.py` builds the same data from either.

Every name is invented, every address is on example.com and every phone number is a fake one. The keys
(`contoso`, `alex`, …) are only for the seeding code; the shape of the data (stages, rounds, dates) is in
`seed_demo.py` and is the same in every language. Stage ids and names stay the defaults: the app translates
default stage names itself.
"""

from __future__ import annotations

EN = {
    "currency": "GBP",
    # key -> (name, website)
    "companies": {
        "contoso": ("Contoso", "https://contoso.example.com"),
        "fabrikam": ("Fabrikam", "https://fabrikam.example.com"),
        "tailspin": ("Tailspin Toys", "https://tailspintoys.example.com"),
        "wideworld": ("Wide World Importers", "https://wideworldimporters.example.com"),
        "adventure": ("Adventure Works", "https://adventureworks.example.com"),
        "litware": ("Litware", "https://litware.example.com"),
        "proseware": ("Proseware", "https://proseware.example.com"),
        "northwind": ("Northwind Traders", "https://northwindtraders.example.com"),
        "coho": ("Coho Winery", "https://cohowinery.example.com"),
        "alpine": ("Alpine Ski House", "https://alpineskihouse.example.com"),
        "startup": ("Northwind Pay", "https://pay.northwind.example.com"),
    },
    # key -> (name, email domain under example.com)
    "agencies": {"northwind": ("Northwind Talent", "northwind"), "blue": ("Blue Yonder Recruitment", "blue")},
    # key -> (name, email handle)
    "recruiters": {
        "alex": ("Alex Morgan", "alex.morgan"),
        "sam": ("Sam Patel", "sam.patel"),
        "jordan": ("Jordan Lee", "jordan.lee"),
    },
    "recruiter_title": "Senior Consultant",
    "phone": "+44 7700 900{n:03d}",
    # application key -> (role title, tags)
    "apps": {
        "contoso": ("Senior Backend Engineer", ["python", "fintech"]),
        "fabrikam": ("Staff Platform Engineer", ["kubernetes"]),
        "tailspin": ("Engineering Manager", ["management"]),
        "wideworld": ("Senior Python Developer", ["python", "remote"]),
        "adventure": ("Backend Engineer (Go)", ["go"]),
        "litware": ("Senior Software Engineer", ["python"]),
        "proseware": ("Data Platform Engineer", ["data"]),
        "northwind": ("Lead Engineer", ["leadership"]),
        "coho": ("Full-stack Engineer", ["typescript", "react"]),
        "coho_direct": ("Senior Full-stack Engineer", ["typescript"]),
        "alpine": ("Site Reliability Engineer", ["sre"]),
    },
    "locations": {},  # application key -> where the job is
    "rounds": {
        "screen": "Recruiter screen",
        "interviewing": "Engineering manager chat",
        "final": "Final with the CTO",
        "system_design": "System design test",
    },
    "intro_call": "Intro call with {name}",
    "move_reasons": ("Their manager is away", "A clash with another interview"),
    # (title, body): a call with the first recruiter (linked to their first application) and a plan.
    "notes": [
        (
            "Call with Alex about Contoso",
            "## Role\n\n- Payments platform, **Python + Kafka**\n- Hybrid, 2 days in London\n\n"
            "## Money\n\n| | |\n|---|---|\n| Day rate | £650 |\n| IR35 | Outside |\n\n"
            "- [ ] Send updated CV\n- [x] Confirm availability\n",
        ),
        (
            "Job search plan",
            "Focus on **fintech** and **platform** roles.\n\n1. Five applications a week\n2. Chase after 7 days\n",
        ),
    ],
    # The two offers to compare, a permanent package and a contract; then the two that ended.
    "offer_permanent": dict(
        salary=95_000,
        bonus=9_500,
        equity="Share options, 4-year vest",
        equity_value=4_000,
        pension_percent=6,
        holiday_days=28,
        benefits="Private health, £1,000 learning budget",
    ),
    "offer_contract": dict(day_rate=600, ir35="outside"),
    "offer_declined": dict(salary=88_000, holiday_days=25, notes="Five days in the office"),
    "offer_withdrawn": dict(salary=105_000),
    "catch_up": (
        "Market catch-up",
        "Contract market is picking up. Three roles to look at: **Fabrikam**, **Proseware** and a fintech startup.",
    ),
    # The roles from that call (two still to decide, one passed on), then two more recruiters pitched.
    "role_contract": dict(
        title="Platform Engineer (contract)", employment_type="contract", day_rate=625, ir35="outside"
    ),
    "role_founding": dict(title="Founding Backend Engineer", salary_min=90_000, salary_max=110_000),
    "role_passed": dict(title="Data Engineer", decision_reason="Mostly BI work, not what I'm after"),
    "role_sre": dict(title="Contract SRE", ir35="inside", decision_reason="Inside IR35, and five days in the office"),
    "role_frontend": dict(title="Senior Frontend Engineer"),
    "earlier_catch_up": ("Earlier catch-up", "Introductions; sent over my CV."),
    "new_year": ("Roles for the new year", "- Day rates for platform roles\n- Anything fully remote?"),
    "sam_call": "Contract roles",
    "jordan_call": "Intro",
    "feedback_call": "Feedback on the final",
    "todos": (
        "They messaged me on LinkedIn: reply",
        "See what Northwind Pay actually builds: do I like the product?",
        "Ask who's on the platform team",
        "Update my portfolio site",
    ),
    "cv": ("Backend CV", "v2", "v3 (impact first)", "Leads with results"),
    "letter": ("Short cover letter", "plain"),
    "portfolio": "Portfolio",
    # (file name, the text in its made-up PDF: ASCII, as the PDF's font has no other letters)
    "files": {
        "cv": ("CV 2026.pdf", "CV"),
        "jd": ("Job description.pdf", "Job description"),
        "rates": ("Contract rates.pdf", "Rates"),
    },
    # (url, title) on an application, a role, a company and a person
    "links": (
        ("https://careers.contoso.example.com/jobs/1234", "Job ad"),
        ("https://pay.northwind.example.com/careers", None),
        ("https://contoso.example.com/engineering", "Engineering blog"),
        ("https://northwindtalent.example.com/team/alex-morgan", "Profile"),
    ),
}

# Simplified Chinese, as a software engineer job-hunting in mainland China would write it (terms from the
# glossary, docs/i18n/zh-CN.md). Pay is in CNY a year, as the app stores it: monthly base × 12 as the salary
# and the extra months (a 15-month package) as the bonus.
ZH_CN = {
    "currency": "CNY",
    "companies": {
        "contoso": ("青梧支付", "https://qingwu.example.com"),
        "fabrikam": ("栈桥云", "https://zhanqiao.example.com"),
        "tailspin": ("竹蜻蜓互娱", "https://zhuqingting.example.com"),
        "wideworld": ("远帆跨境", "https://yuanfan.example.com"),
        "adventure": ("野径户外", "https://yejing.example.com"),
        "litware": ("墨砚软件", "https://moyan.example.com"),
        "proseware": ("数川数据", "https://shuchuan.example.com"),
        "northwind": ("北风商贸", "https://beifeng.example.com"),
        "coho": ("柚见生鲜", "https://youjian.example.com"),
        "alpine": ("雪岭滑雪", "https://xueling.example.com"),
        "startup": ("北风支付", "https://pay.beifeng.example.com"),
    },
    "agencies": {"northwind": ("识途猎头", "shitu"), "blue": ("远望人才顾问", "yuanwang")},
    "recruiters": {
        "alex": ("周昕", "zhou.xin"),
        "sam": ("陈思远", "chen.siyuan"),
        "jordan": ("林雨桐", "lin.yutong"),
    },
    "recruiter_title": "资深猎头顾问",
    "phone": "138-0000-{n:04d}",
    "apps": {
        "contoso": ("高级后端工程师 (Python)", ["python", "金融科技"]),
        "fabrikam": ("资深平台工程师", ["kubernetes"]),
        "tailspin": ("研发经理", ["管理"]),
        "wideworld": ("高级 Python 开发工程师", ["python", "远程"]),
        "adventure": ("后端开发工程师 (Go)", ["go"]),
        "litware": ("高级软件工程师", ["python"]),
        "proseware": ("数据平台工程师", ["数据"]),
        "northwind": ("技术负责人", ["带团队"]),
        "coho": ("全栈工程师", ["typescript", "react"]),
        "coho_direct": ("高级全栈工程师", ["typescript"]),
        "alpine": ("SRE 工程师", ["sre"]),
    },
    "locations": {
        "contoso": "上海",
        "fabrikam": "杭州",
        "tailspin": "深圳",
        "wideworld": "深圳",
        "adventure": "北京",
        "litware": "北京",
        "proseware": "杭州",
        "northwind": "上海",
        "coho": "上海",
        "coho_direct": "上海",
        "alpine": "北京",
    },
    "rounds": {
        "screen": "猎头初筛电话",
        "interviewing": "技术经理面",
        "final": "CTO 终面",
        "system_design": "系统设计面",
    },
    "intro_call": "和{name}初次沟通",
    "move_reasons": ("对方面试官出差了", "和另一场面试撞时间了"),
    "notes": [
        (
            "和周昕聊青梧支付",
            "## 职位\n\n- 支付平台，**Python + Kafka**\n- 混合办公，每周 2 天去上海办公室\n\n"
            "## 薪资\n\n| | |\n|---|---|\n| 月薪 | 40-50k |\n| 年终 | 3 个月，15 薪 |\n\n"
            "- [ ] 发一份更新后的简历\n- [x] 确认到岗时间\n",
        ),
        (
            "求职计划",
            "重点看 **金融科技** 和 **平台** 方向的职位。\n\n1. 每周投 5 份\n2. 7 天没回复就催问\n",
        ),
    ],
    "offer_permanent": dict(
        salary=540_000,
        bonus=135_000,
        equity="期权，分 4 年归属",
        equity_value=50_000,
        holiday_days=10,
        benefits="六险一金（公积金 12%），补充医疗，每年 5,000 元学习预算",
    ),
    "offer_contract": dict(day_rate=2_500),
    "offer_declined": dict(salary=420_000, holiday_days=5, notes="每周五天坐班，通勤单程一个半小时"),
    "offer_withdrawn": dict(salary=650_000),
    "catch_up": (
        "聊聊最近的行情",
        "合同岗的行情在回暖。有三个职位可以看看：**栈桥云**、**数川数据**，还有一家做支付的创业公司。",
    ),
    "role_contract": dict(title="平台工程师（合同制）", employment_type="contract", day_rate=2_800, currency="CNY"),
    "role_founding": dict(title="创始团队后端工程师", salary_min=500_000, salary_max=700_000, currency="CNY"),
    "role_passed": dict(title="数据工程师", decision_reason="主要是做 BI 报表，不是我想要的方向"),
    "role_sre": dict(title="合同制 SRE", decision_reason="外包驻场，而且每周五天坐班"),
    "role_frontend": dict(title="高级前端工程师"),
    "earlier_catch_up": ("第一次沟通", "互相认识了一下，把简历发过去了。"),
    "new_year": ("年后的机会", "- 平台方向合同岗的日薪\n- 有没有完全远程的？"),
    "sam_call": "合同岗机会",
    "jordan_call": "初次沟通",
    "feedback_call": "终面反馈",
    "todos": (
        "他私信我了：记得回复",
        "看看北风支付到底在做什么产品：我感兴趣吗？",
        "问一下平台团队都有谁",
        "更新个人作品集网站",
    ),
    "cv": ("后端简历", "v2", "v3（突出成果）", "开头先写成果"),
    "letter": ("简短求职信", "简洁版"),
    "portfolio": "作品集",
    "files": {
        "cv": ("简历 2026.pdf", "CV"),
        "jd": ("职位描述.pdf", "Job description"),
        "rates": ("合同岗日薪参考.pdf", "Rates"),
    },
    "links": (
        ("https://careers.qingwu.example.com/jobs/1234", "招聘信息"),
        ("https://pay.beifeng.example.com/careers", None),
        ("https://qingwu.example.com/engineering", "技术博客"),
        ("https://shitu.example.com/team/zhou-xin", "个人主页"),
    ),
}

CONTENT = {"en": EN, "zh-CN": ZH_CN}
