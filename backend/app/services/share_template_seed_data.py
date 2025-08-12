"""
Seed data for share templates
"""

WELLNESS_CHECK_TEMPLATE = {
    "template_id": "wellness-check-v1",
    "name": "Weekly Wellness Check",
    "description": "General wellness and mood assessment for sharing with care team",
    "category": "wellness",
    "version": "1.0",
    "questions": [
        {
            "id": "mood",
            "text": {
                "en": "How has your mood been this week?",
                "es": "¿Cómo ha estado tu estado de ánimo esta semana?",
                "fr": "Comment a été votre humeur cette semaine?",
                "de": "Wie war Ihre Stimmung diese Woche?",
                "pt": "Como tem estado o seu humor esta semana?",
                "it": "Come è stato il tuo umore questa settimana?",
                "ja": "今週の気分はいかがでしたか？",
                "ko": "이번 주 기분은 어땠나요?",
                "zh": "您这周的心情怎么样？",
                "ar": "كيف كان مزاجك هذا الأسبوع؟",
                "hi": "इस सप्ताह आपका मूड कैसा रहा?",
                "ru": "Как было ваше настроение на этой неделе?"
            },
            "type": "open",
            "required": True,
            "help_text": "Describe your overall emotional state, energy levels, and any mood changes"
        },
        {
            "id": "sleep",
            "text": {
                "en": "How would you describe your sleep quality this week?",
                "es": "¿Cómo describirías tu calidad de sueño esta semana?",
                "fr": "Comment décririez-vous votre qualité de sommeil cette semaine?",
                "de": "Wie würden Sie Ihre Schlafqualität diese Woche beschreiben?",
                "pt": "Como você descreveria a qualidade do seu sono esta semana?",
                "it": "Come descriveresti la qualità del tuo sonno questa settimana?",
                "ja": "今週の睡眠の質をどう表現しますか？",
                "ko": "이번 주 수면의 질을 어떻게 설명하시겠습니까?",
                "zh": "您如何描述这周的睡眠质量？",
                "ar": "كيف تصف جودة نومك هذا الأسبوع؟",
                "hi": "इस सप्ताह आप अपनी नींद की गुणवत्ता का वर्णन कैसे करेंगे?",
                "ru": "Как бы вы описали качество своего сна на этой неделе?"
            },
            "type": "open",
            "required": True,
            "help_text": "Include information about sleep duration, quality, and any disturbances"
        },
        {
            "id": "activities",
            "text": {
                "en": "What activities or self-care practices have you engaged in?",
                "es": "¿En qué actividades o prácticas de autocuidado has participado?",
                "fr": "Quelles activités ou pratiques de soins personnels avez-vous pratiquées?",
                "de": "An welchen Aktivitäten oder Selbstfürsorge-Praktiken haben Sie teilgenommen?",
                "pt": "Em que atividades ou práticas de autocuidado você se envolveu?",
                "it": "A quali attività o pratiche di cura di sé ti sei dedicato?",
                "ja": "どのような活動やセルフケアの実践に取り組みましたか？",
                "ko": "어떤 활동이나 자기관리 실천을 하셨나요?",
                "zh": "您参与了哪些活动或自我护理实践？",
                "ar": "ما هي الأنشطة أو ممارسات الرعاية الذاتية التي شاركت فيها؟",
                "hi": "आपने किन गतिविधियों या स्वयं की देखभाल की प्रथाओं में भाग लिया है?",
                "ru": "В каких мероприятиях или практиках самообслуживания вы участвовали?"
            },
            "type": "open",
            "required": False,
            "help_text": "Include exercise, hobbies, social activities, relaxation techniques, etc."
        },
        {
            "id": "challenges",
            "text": {
                "en": "What challenges or concerns have you faced this week?",
                "es": "¿Qué desafíos o preocupaciones has enfrentado esta semana?",
                "fr": "Quels défis ou préoccupations avez-vous rencontrés cette semaine?",
                "de": "Welche Herausforderungen oder Sorgen hatten Sie diese Woche?",
                "pt": "Que desafios ou preocupações você enfrentou esta semana?",
                "it": "Quali sfide o preoccupazioni hai affrontato questa settimana?",
                "ja": "今週どのような課題や心配事に直面しましたか？",
                "ko": "이번 주에 어떤 도전이나 우려사항에 직면하셨나요?",
                "zh": "您这周面临了哪些挑战或担忧？",
                "ar": "ما هي التحديات أو المخاوف التي واجهتها هذا الأسبوع؟",
                "hi": "इस सप्ताह आपने किन चुनौतियों या चिंताओं का सामना किया है?",
                "ru": "С какими проблемами или заботами вы столкнулись на этой неделе?"
            },
            "type": "open",
            "required": False,
            "help_text": "Share any difficulties, stressors, or areas where you need support"
        },
        {
            "id": "goals",
            "text": {
                "en": "What are your goals or intentions for the upcoming week?",
                "es": "¿Cuáles son tus objetivos o intenciones para la próxima semana?",
                "fr": "Quels sont vos objectifs ou intentions pour la semaine à venir?",
                "de": "Was sind Ihre Ziele oder Absichten für die kommende Woche?",
                "pt": "Quais são seus objetivos ou intenções para a próxima semana?",
                "it": "Quali sono i tuoi obiettivi o intenzioni per la prossima settimana?",
                "ja": "来週の目標や意図は何ですか？",
                "ko": "다음 주의 목표나 의도는 무엇인가요?",
                "zh": "您下周的目标或意图是什么？",
                "ar": "ما هي أهدافك أو نواياك للأسبوع القادم؟",
                "hi": "आने वाले सप्ताह के लिए आपके लक्ष्य या इरादे क्या हैं?",
                "ru": "Каковы ваши цели или намерения на предстоящую неделю?"
            },
            "type": "open",
            "required": False,
            "help_text": "Include specific goals for self-care, activities, or areas of focus"
        }
    ],
    "is_active": True
}

MEDICAL_VISIT_TEMPLATE = {
    "template_id": "medical-visit-prep-v1",
    "name": "Medical Visit Preparation",
    "description": "Summary for sharing with healthcare providers before appointments",
    "category": "medical",
    "version": "1.0",
    "questions": [
        {
            "id": "symptoms",
            "text": {
                "en": "What symptoms or health concerns have you experienced recently?",
                "es": "¿Qué síntomas o problemas de salud has experimentado recientemente?",
                "fr": "Quels symptômes ou problèmes de santé avez-vous ressentis récemment?",
                "de": "Welche Symptome oder Gesundheitsprobleme haben Sie kürzlich erlebt?",
                "pt": "Que sintomas ou preocupações de saúde você experimentou recentemente?",
                "it": "Quali sintomi o problemi di salute hai sperimentato di recente?",
                "ja": "最近どのような症状や健康上の心配がありましたか？",
                "ko": "최근에 어떤 증상이나 건강상의 우려를 경험하셨나요?",
                "zh": "您最近经历了哪些症状或健康问题？",
                "ar": "ما هي الأعراض أو المخاوف الصحية التي واجهتها مؤخراً؟",
                "hi": "आपने हाल ही में कौन से लक्षण या स्वास्थ्य संबंधी चिंताएं अनुभव की हैं?",
                "ru": "Какие симптомы или проблемы со здоровьем вы испытывали в последнее время?"
            },
            "type": "open",
            "required": True,
            "help_text": "Describe any physical or mental health symptoms, their frequency and severity"
        },
        {
            "id": "medications",
            "text": {
                "en": "How have you been managing with your current medications?",
                "es": "¿Cómo te has estado manejando con tus medicamentos actuales?",
                "fr": "Comment vous débrouillez-vous avec vos médicaments actuels?",
                "de": "Wie kommen Sie mit Ihren aktuellen Medikamenten zurecht?",
                "pt": "Como você tem se saído com seus medicamentos atuais?",
                "it": "Come te la stai cavando con i tuoi farmaci attuali?",
                "ja": "現在の薬でどのように管理していますか？",
                "ko": "현재 복용 중인 약물로 어떻게 지내고 계신가요?",
                "zh": "您目前的药物治疗情况如何？",
                "ar": "كيف تتعامل مع أدويتك الحالية؟",
                "hi": "आप अपनी वर्तमान दवाओं के साथ कैसे काम कर रहे हैं?",
                "ru": "Как вы справляетесь с текущими лекарствами?"
            },
            "type": "open",
            "required": False,
            "help_text": "Include any side effects, adherence issues, or effectiveness concerns"
        },
        {
            "id": "functional_impact",
            "text": {
                "en": "How have your health concerns affected your daily activities?",
                "es": "¿Cómo han afectado tus problemas de salud a tus actividades diarias?",
                "fr": "Comment vos problèmes de santé ont-ils affecté vos activités quotidiennes?",
                "de": "Wie haben sich Ihre Gesundheitsprobleme auf Ihre täglichen Aktivitäten ausgewirkt?",
                "pt": "Como suas preocupações de saúde afetaram suas atividades diárias?",
                "it": "Come i tuoi problemi di salute hanno influenzato le tue attività quotidiane?",
                "ja": "健康上の心配は日常生活にどのような影響を与えていますか？",
                "ko": "건강 문제가 일상 활동에 어떤 영향을 미쳤나요?",
                "zh": "您的健康问题如何影响了您的日常活动？",
                "ar": "كيف أثرت مخاوفك الصحية على أنشطتك اليومية؟",
                "hi": "आपकी स्वास्थ्य चिंताओं ने आपकी दैनिक गतिविधियों को कैसे प्रभावित किया है?",
                "ru": "Как ваши проблемы со здоровьем повлияли на вашу повседневную деятельность?"
            },
            "type": "open",
            "required": False,
            "help_text": "Describe impact on work, relationships, self-care, and quality of life"
        },
        {
            "id": "questions_for_provider",
            "text": {
                "en": "What questions or topics do you want to discuss with your healthcare provider?",
                "es": "¿Qué preguntas o temas quieres discutir con tu proveedor de atención médica?",
                "fr": "Quelles questions ou sujets souhaitez-vous discuter avec votre professionnel de la santé?",
                "de": "Welche Fragen oder Themen möchten Sie mit Ihrem Gesundheitsdienstleister besprechen?",
                "pt": "Que perguntas ou tópicos você quer discutir com seu profissional de saúde?",
                "it": "Quali domande o argomenti vuoi discutere con il tuo operatore sanitario?",
                "ja": "医療提供者と話し合いたい質問や話題は何ですか？",
                "ko": "의료 서비스 제공자와 논의하고 싶은 질문이나 주제는 무엇인가요?",
                "zh": "您想与您的医疗保健提供者讨论哪些问题或话题？",
                "ar": "ما هي الأسئلة أو المواضيع التي تريد مناقشتها مع مقدم الرعاية الصحية؟",
                "hi": "आप अपने स्वास्थ्य सेवा प्रदाता के साथ कौन से प्रश्न या विषय पर चर्चा करना चाहते हैं?",
                "ru": "Какие вопросы или темы вы хотите обсудить со своим поставщиком медицинских услуг?"
            },
            "type": "open",
            "required": False,
            "help_text": "List specific questions, concerns, or treatment options you want to explore"
        }
    ],
    "is_active": True
}

MOOD_TRACKER_TEMPLATE = {
    "template_id": "mood-tracker-v1",
    "name": "Mood Tracking Summary",
    "description": "Weekly mood and emotional wellness summary for mental health support",
    "category": "mental_health",
    "version": "1.0",
    "questions": [
        {
            "id": "mood_patterns",
            "text": {
                "en": "What mood patterns have you noticed this week?",
                "es": "¿Qué patrones de humor has notado esta semana?",
                "fr": "Quels modèles d'humeur avez-vous remarqués cette semaine?",
                "de": "Welche Stimmungsmuster haben Sie diese Woche bemerkt?",
                "pt": "Que padrões de humor você notou esta semana?",
                "it": "Quali schemi dell'umore hai notato questa settimana?",
                "ja": "今週どのような気分のパターンに気づきましたか？",
                "ko": "이번 주에 어떤 기분 패턴을 발견하셨나요?",
                "zh": "您这周注意到了哪些情绪模式？",
                "ar": "ما هي أنماط المزاج التي لاحظتها هذا الأسبوع؟",
                "hi": "इस सप्ताह आपने कौन से मूड पैटर्न देखे हैं?",
                "ru": "Какие закономерности настроения вы заметили на этой неделе?"
            },
            "type": "open",
            "required": True,
            "help_text": "Describe emotional highs, lows, triggers, and overall patterns"
        },
        {
            "id": "coping_strategies",
            "text": {
                "en": "What coping strategies have you used, and how effective were they?",
                "es": "¿Qué estrategias de afrontamiento has usado y qué tan efectivas fueron?",
                "fr": "Quelles stratégies d'adaptation avez-vous utilisées et quelle a été leur efficacité?",
                "de": "Welche Bewältigungsstrategien haben Sie verwendet und wie effektiv waren sie?",
                "pt": "Que estratégias de enfrentamento você usou e quão eficazes foram?",
                "it": "Quali strategie di coping hai usato e quanto sono state efficaci?",
                "ja": "どのような対処戦略を使い、それらはどの程度効果的でしたか？",
                "ko": "어떤 대처 전략을 사용하셨고, 얼마나 효과적이었나요?",
                "zh": "您使用了哪些应对策略，它们有多有效？",
                "ar": "ما هي استراتيجيات التأقلم التي استخدمتها، وما مدى فعاليتها؟",
                "hi": "आपने कौन सी मुकाबला रणनीतियों का उपयोग किया है, और वे कितनी प्रभावी थीं?",
                "ru": "Какие стратегии преодоления вы использовали и насколько они были эффективными?"
            },
            "type": "open",
            "required": False,
            "help_text": "Include breathing exercises, mindfulness, social support, etc."
        },
        {
            "id": "triggers",
            "text": {
                "en": "What situations or events seemed to impact your mood most?",
                "es": "¿Qué situaciones o eventos parecieron impactar más tu estado de ánimo?",
                "fr": "Quelles situations ou événements ont semblé le plus impacter votre humeur?",
                "de": "Welche Situationen oder Ereignisse schienen Ihre Stimmung am meisten zu beeinflussen?",
                "pt": "Que situações ou eventos pareceram impactar mais seu humor?",
                "it": "Quali situazioni o eventi sembravano influenzare di più il tuo umore?",
                "ja": "どのような状況や出来事があなたの気分に最も影響を与えたようですか？",
                "ko": "어떤 상황이나 사건이 기분에 가장 큰 영향을 미쳤나요?",
                "zh": "哪些情况或事件似乎对您的情绪影响最大？",
                "ar": "ما هي المواقف أو الأحداث التي بدت وكأنها تؤثر على مزاجك أكثر من غيرها؟",
                "hi": "कौन सी स्थितियां या घटनाएं आपके मूड को सबसे ज्यादा प्रभावित करती दिखीं?",
                "ru": "Какие ситуации или события, казалось, больше всего повлияли на ваше настроение?"
            },
            "type": "open",
            "required": False,
            "help_text": "Identify specific triggers, stressors, or positive influences"
        },
        {
            "id": "support_needs",
            "text": {
                "en": "What kind of support would be most helpful for you right now?",
                "es": "¿Qué tipo de apoyo sería más útil para ti ahora mismo?",
                "fr": "Quel type de soutien vous serait le plus utile en ce moment?",
                "de": "Welche Art von Unterstützung wäre für Sie gerade am hilfreichsten?",
                "pt": "Que tipo de apoio seria mais útil para você agora?",
                "it": "Che tipo di supporto sarebbe più utile per te in questo momento?",
                "ja": "今、どのようなサポートが最も役に立つでしょうか？",
                "ko": "지금 어떤 종류의 지원이 가장 도움이 될까요?",
                "zh": "现在什么样的支持对您最有帮助？",
                "ar": "ما نوع الدعم الذي سيكون أكثر فائدة لك الآن؟",
                "hi": "अभी आपके लिए किस प्रकार का समर्थन सबसे उपयोगी होगा?",
                "ru": "Какая поддержка была бы наиболее полезной для вас прямо сейчас?"
            },
            "type": "open",
            "required": False,
            "help_text": "Describe what you need from your support network or care team"
        }
    ],
    "is_active": True
}

SEED_TEMPLATES = [
    WELLNESS_CHECK_TEMPLATE,
    MEDICAL_VISIT_TEMPLATE,
    MOOD_TRACKER_TEMPLATE
]
