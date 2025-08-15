"""seed_share_templates_v1

Revision ID: ff01_seed_share_templates_v1
Revises: 7c39d7b141c7
Create Date: 2025-08-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import text
import json
import uuid

# revision identifiers, used by Alembic.
revision = 'ff01_seed_share_templates_v1'
down_revision = '7c39d7b141c7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Note: generate UUIDs in Python to avoid DB extension dependency

    # Define target templates (English-only)
    templates = [
        {
            "template_id": "wellness-check-v1",
            "name": "Regular Wellness Check",
            "description": "Concise regular status for general wellness",
            "category": "wellness",
            "version": "1.0",
            "is_active": True,
            "questions": [
                {"id": "period_overview", "text": {"en": "What were the biggest changes or themes this period?"}, "type": "open", "required": True, "help_text": "1–3 sentences highlighting what stands out since last check-in"},
                {"id": "mood_rating", "text": {"en": "Rate your mood (0–10) and describe notable highs/lows."}, "type": "open", "required": True},
                {"id": "sleep_quality", "text": {"en": "Sleep: hours, quality, awakenings, naps."}, "type": "open", "required": True},
                {"id": "energy_fatigue", "text": {"en": "Energy/fatigue: typical day vs worst day; what helped?"}, "type": "open", "required": False},
                {"id": "pain_summary", "text": {"en": "Pain: location(s), intensity (0–10), pattern, triggers."}, "type": "open", "required": False},
                {"id": "physical_activity", "text": {"en": "Physical activity: type, frequency, duration; impact on symptoms."}, "type": "open", "required": False},
                {"id": "nutrition_digestive", "text": {"en": "Nutrition/appetite/digestion: any changes worth noting?"}, "type": "open", "required": False},
                {"id": "stressors_coping", "text": {"en": "Stressors and coping: what came up; what worked or didn’t?"}, "type": "open", "required": False},
                {"id": "social_connections", "text": {"en": "Social connections: interactions that helped or drained you."}, "type": "open", "required": False},
                {"id": "next_week_goals", "text": {"en": "Goals for next period and support needed."}, "type": "open", "required": True},
            ],
        },
        {
            "template_id": "mood-tracker-v1",
            "name": "Mood Tracking Summary",
            "description": "Mental health snapshot to guide care adjustments",
            "category": "mental_health",
            "version": "1.0",
            "is_active": True,
            "questions": [
                {"id": "overall_mood", "text": {"en": "Overall mood this period: rate 0–10 and brief summary."}, "type": "open", "required": True},
                {"id": "anxiety_level", "text": {"en": "Anxiety level (0–10) and main drivers."}, "type": "open", "required": False},
                {"id": "mood_triggers", "text": {"en": "Triggers/events that most affected mood."}, "type": "open", "required": False},
                {"id": "coping_strategies", "text": {"en": "Coping strategies used; what worked, what to change."}, "type": "open", "required": False},
                {"id": "thought_patterns", "text": {"en": "Notable thought patterns: worries/negative thoughts/rumination."}, "type": "open", "required": False},
                {"id": "sleep_impact", "text": {"en": "How did sleep impact mood/anxiety?"}, "type": "open", "required": False},
                {"id": "safety_check", "text": {"en": "Any self-harm thoughts/urges? Protective factors?"}, "type": "open", "required": True},
                {"id": "medication_effects", "text": {"en": "Medication adherence/effects (if applicable)."}, "type": "open", "required": False},
                {"id": "therapy_progress", "text": {"en": "Therapy homework or self-help progress."}, "type": "open", "required": False},
                {"id": "support_needed", "text": {"en": "Support needed now (specific asks)."}, "type": "open", "required": True},
            ],
        },
        {
            "template_id": "medical-visit-prep-v1",
            "name": "Medical Visit Prep",
            "description": "Prepare for medication-focused review or appointment",
            "category": "medical",
            "version": "1.0",
            "is_active": True,
            "questions": [
                {"id": "visit_goals", "text": {"en": "Visit purpose/goals: decisions you want to make."}, "type": "open", "required": True},
                {"id": "current_medications", "text": {"en": "Current meds (name, dose, frequency, indication, start date); changes since last visit."}, "type": "open", "required": True},
                {"id": "adherence", "text": {"en": "Adherence: missed doses, reasons, patterns."}, "type": "open", "required": True},
                {"id": "side_effects", "text": {"en": "Side effects: what, when, severity, impact."}, "type": "open", "required": True},
                {"id": "perceived_effectiveness", "text": {"en": "Perceived effectiveness for target symptoms (improved/worsened)."}, "type": "open", "required": False},
                {"id": "other_substances", "text": {"en": "OTC/supplements/alcohol/caffeine; possible interactions."}, "type": "open", "required": False},
                {"id": "symptom_timeline", "text": {"en": "Symptom timeline since last review (brief; include dates if possible)."}, "type": "open", "required": False},
                {"id": "measurements", "text": {"en": "Measurements if tracked (BP, HR, weight, glucose, etc.)."}, "type": "open", "required": False},
                {"id": "tests_labs", "text": {"en": "Tests/labs/results since last visit (value + date)."}, "type": "open", "required": False},
                {"id": "questions_for_provider", "text": {"en": "Questions for provider; preferences/constraints (e.g., non-sedating, cost)."}, "type": "open", "required": True},
            ],
        },
        {
            "template_id": "therapy-session-prep-v1",
            "name": "Therapy Session Prep",
            "description": "Focus the session and track progress",
            "category": "therapy",
            "version": "1.0",
            "is_active": True,
            "questions": [
                {"id": "session_topics", "text": {"en": "Top 1–3 topics to discuss this session."}, "type": "open", "required": True},
                {"id": "since_last_session", "text": {"en": "Since last session: mood/anxiety highlights; key events."}, "type": "open", "required": True},
                {"id": "standout_triggers", "text": {"en": "Triggers/situations that stood out; your reactions."}, "type": "open", "required": False},
                {"id": "coping_skills_used", "text": {"en": "Coping skills used (what worked, what didn’t)."}, "type": "open", "required": False},
                {"id": "homework_progress", "text": {"en": "Homework/goals progress; blockers to discuss."}, "type": "open", "required": False},
                {"id": "relationship_patterns", "text": {"en": "Relationship/communication patterns noticed."}, "type": "open", "required": False},
                {"id": "recent_wins", "text": {"en": "Wins/strengths you want to reinforce."}, "type": "open", "required": False},
                {"id": "problem_solving_needs", "text": {"en": "Challenges you want help problem-solving."}, "type": "open", "required": True},
                {"id": "therapy_safety_check", "text": {"en": "Safety check: self-harm thoughts/urges; crisis plan needs."}, "type": "open", "required": False},
                {"id": "therapist_requests", "text": {"en": "Requests for therapist (tools, reframes, practice items)."}, "type": "open", "required": True},
            ],
        },
        {
            "template_id": "caregiver-update-v1",
            "name": "Caregiver Update",
            "description": "Clear, actionable update for family/caregivers",
            "category": "caregiver",
            "version": "1.0",
            "is_active": True,
            "questions": [
                {"id": "overall_status", "text": {"en": "Overall status since last update (1–2 sentences)."}, "type": "open", "required": True},
                {"id": "mood_behavior", "text": {"en": "Mood/behavior changes worth noting."}, "type": "open", "required": False},
                {"id": "sleep_appetite", "text": {"en": "Sleep/appetite changes."}, "type": "open", "required": False},
                {"id": "caregiver_medication", "text": {"en": "Medication adherence and any changes made."}, "type": "open", "required": False},
                {"id": "daily_functioning", "text": {"en": "Daily functioning (work/school, ADLs/IADLs); where help is needed."}, "type": "open", "required": True},
                {"id": "symptoms_pain", "text": {"en": "Notable symptoms or pain and what helps."}, "type": "open", "required": False},
                {"id": "social_activities", "text": {"en": "Social interactions/activities: helpful vs draining."}, "type": "open", "required": False},
                {"id": "safety_concerns", "text": {"en": "Safety concerns or incidents; how to mitigate."}, "type": "open", "required": False},
                {"id": "upcoming_appointments", "text": {"en": "Upcoming appointments or tasks."}, "type": "open", "required": False},
                {"id": "caregiver_support_requests", "text": {"en": "Specific ways caregivers can help this week."}, "type": "open", "required": True},
            ],
        },
        {
            "template_id": "ai-advisor-upload-v1",
            "name": "Online AI Advisor Upload",
            "description": "Concise, structured briefing to paste into an AI advisor",
            "category": "ai_advisor",
            "version": "1.0",
            "is_active": True,
            "questions": [
                {"id": "ai_context", "text": {"en": "Context: age, key diagnoses/conditions, relevant history (1–3 lines)."}, "type": "open", "required": True},
                {"id": "ai_goals_questions", "text": {"en": "Goals/questions you want advice on (bullet list)."}, "type": "open", "required": True},
                {"id": "ai_symptom_timeline", "text": {"en": "Symptom timeline: key events with brief dates; severity trends."}, "type": "open", "required": False},
                {"id": "ai_medications_allergies", "text": {"en": "Current meds list (name, dose, frequency, indication, start date); allergies/intolerances."}, "type": "open", "required": True},
                {"id": "ai_recent_labs", "text": {"en": "Recent labs/tests/procedures with values and dates."}, "type": "open", "required": False},
                {"id": "ai_prior_treatments", "text": {"en": "Treatments tried before and responses (benefits/side effects, stop reasons)."}, "type": "open", "required": False},
                {"id": "ai_constraints", "text": {"en": "Constraints/preferences (e.g., non-sedating, cost, pregnancy, work schedule)."}, "type": "open", "required": False},
                {"id": "ai_red_flags", "text": {"en": "Red flags/urgent concerns to consider (if any)."}, "type": "open", "required": False},
                {"id": "ai_nonpharm_strategies", "text": {"en": "Non-pharmacologic strategies tried (sleep, exercise, therapy)."}, "type": "open", "required": False},
                {"id": "ai_good_answer_criteria", "text": {"en": "What a good answer should include (decision criteria, options to discuss with clinician)."}, "type": "open", "required": True},
            ],
        },
    ]

    # Remove shares referencing templates that will be replaced (dev only guidance)
    # Then upsert templates and remove any others
    conn.execute(text("""
        DELETE FROM shares WHERE template_id NOT IN (
            'wellness-check-v1','mood-tracker-v1','medical-visit-prep-v1','therapy-session-prep-v1','caregiver-update-v1','ai-advisor-upload-v1'
        );
    """))

    # Upsert templates
    for t in templates:
        conn.execute(text("""
            INSERT INTO share_templates (id, template_id, name, description, category, version, questions, is_active, created_at, updated_at)
            VALUES (:id, :template_id, :name, :description, :category, :version, CAST(:questions AS JSONB), :is_active, now(), now())
            ON CONFLICT (template_id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                category = EXCLUDED.category,
                version = EXCLUDED.version,
                questions = EXCLUDED.questions,
                is_active = EXCLUDED.is_active,
                updated_at = now();
        """), {
            "id": str(uuid.uuid4()),
            "template_id": t["template_id"],
            "name": t["name"],
            "description": t.get("description"),
            "category": t.get("category"),
            "version": t["version"],
            "questions": json.dumps(t["questions"]),
            "is_active": t["is_active"],
        })

    # Deactivate (or remove) any other templates not in list
    conn.execute(text("""
        DELETE FROM share_templates WHERE template_id NOT IN (
            'wellness-check-v1','mood-tracker-v1','medical-visit-prep-v1','therapy-session-prep-v1','caregiver-update-v1','ai-advisor-upload-v1'
        );
    """))


def downgrade() -> None:
    conn = op.get_bind()
    # Best-effort rollback: deactivate all custom templates inserted by this migration
    conn.execute(text("""
        DELETE FROM share_templates WHERE template_id IN (
            'wellness-check-v1','mood-tracker-v1','medical-visit-prep-v1','therapy-session-prep-v1','caregiver-update-v1','ai-advisor-upload-v1'
        );
    """))

