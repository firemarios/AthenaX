"""initial schema (contracts §5.7 tables + §9.2 city tables)

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-10 19:53:09.403196

Baseline generated from app.models.Base.metadata (25 tables, no FK constraints —
relations are plain id strings per contracts §5.7). PostGIS extension must exist
before `city_features.geom` is created (infrastructure/database/init-db/01-extensions.sql).
"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'api_registry',
        sa.Column('method', sa.String(length=10), nullable=False),
        sa.Column('path', sa.String(length=300), nullable=False),
        sa.Column('summary', sa.String(length=500), nullable=True),
        sa.Column('module', sa.String(length=100), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        'audit_logs',
        sa.Column('method', sa.String(length=10), nullable=False),
        sa.Column('path', sa.String(length=500), nullable=False),
        sa.Column('status', sa.Integer(), nullable=True),
        sa.Column('ip', sa.String(length=60), nullable=True),
        sa.Column('request_id', sa.String(length=64), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_audit_logs_request_id', 'audit_logs', ['request_id'], unique=False)

    op.create_table(
        'cities',
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('name_el', sa.String(length=120), nullable=True),
        sa.Column('country', sa.String(length=80), nullable=True),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lon', sa.Float(), nullable=True),
        sa.Column('bbox', sa.JSON(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_cities_name', 'cities', ['name'], unique=True)

    op.create_table(
        'city_areas',
        sa.Column('id', sa.Text(), primary_key=True, nullable=False),
        sa.Column('name_el', sa.String(length=200), nullable=True),
        sa.Column('name_en', sa.String(length=200), nullable=True),
        sa.Column('lat', sa.Float(), nullable=True),
        sa.Column('lon', sa.Float(), nullable=True),
        sa.Column('radius_m', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        'city_features',
        sa.Column('id', sa.Text(), primary_key=True, nullable=False),
        sa.Column('layer', sa.String(length=80), nullable=False),
        sa.Column('properties', sa.JSON(), nullable=True),
        sa.Column('geom', Geometry(srid=4326, dimension=2, spatial_index=False, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_city_features_layer', 'city_features', ['layer'], unique=False)

    op.create_table(
        'comments',
        sa.Column('proposal_id', sa.String(length=32), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_comments_proposal_id', 'comments', ['proposal_id'], unique=False)

    op.create_table(
        'connectors',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('display_name', sa.String(length=300), nullable=True),
        sa.Column('endpoint_url', sa.String(length=500), nullable=True),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=True),
        sa.Column('last_checked_at', sa.String(length=40), nullable=True),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_connectors_name', 'connectors', ['name'], unique=True)

    op.create_table(
        'consultations',
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=True),
        sa.Column('starts_at', sa.String(length=40), nullable=True),
        sa.Column('ends_at', sa.String(length=40), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_consultations_status', 'consultations', ['status'], unique=False)
    op.create_index('ix_consultations_title', 'consultations', ['title'], unique=False)

    op.create_table(
        'data_quality_reports',
        sa.Column('dataset_id', sa.String(length=32), nullable=False),
        sa.Column('completeness', sa.Float(), nullable=True),
        sa.Column('freshness', sa.Float(), nullable=True),
        sa.Column('validity', sa.Float(), nullable=True),
        sa.Column('validation_status', sa.String(length=20), nullable=True),
        sa.Column('computed_at', sa.String(length=40), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_data_quality_reports_dataset_id', 'data_quality_reports', ['dataset_id'], unique=False)

    op.create_table(
        'data_sources',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('display_name', sa.String(length=300), nullable=True),
        sa.Column('provider', sa.String(length=200), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('base_url', sa.String(length=500), nullable=True),
        sa.Column('endpoint_url', sa.String(length=500), nullable=True),
        sa.Column('license', sa.String(length=300), nullable=True),
        sa.Column('update_frequency', sa.String(length=50), nullable=True),
        sa.Column('reliability', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('priority', sa.String(length=10), nullable=True),
        sa.Column('last_checked_at', sa.String(length=40), nullable=True),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_data_sources_name', 'data_sources', ['name'], unique=True)
    op.create_index('ix_data_sources_source_type', 'data_sources', ['source_type'], unique=False)

    op.create_table(
        'dataset_versions',
        sa.Column('dataset_id', sa.String(length=32), nullable=False),
        sa.Column('version', sa.String(length=100), nullable=True),
        sa.Column('checksum', sa.String(length=128), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_dataset_versions_dataset_id', 'dataset_versions', ['dataset_id'], unique=False)

    op.create_table(
        'datasets',
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('provider', sa.String(length=200), nullable=True),
        sa.Column('source_id', sa.String(length=32), nullable=True),
        sa.Column('source_name', sa.String(length=200), nullable=True),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('license', sa.String(length=300), nullable=True),
        sa.Column('last_updated', sa.String(length=40), nullable=True),
        sa.Column('fetched_at', sa.String(length=40), nullable=True),
        sa.Column('checksum', sa.String(length=128), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('format', sa.String(length=50), nullable=True),
        sa.Column('geographic_scope', sa.String(length=200), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('quality', sa.JSON(), nullable=True),
        sa.Column('provenance', sa.JSON(), nullable=True),
        sa.Column('resources', sa.JSON(), nullable=True),
        sa.Column('related_ids', sa.JSON(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_datasets_category', 'datasets', ['category'], unique=False)
    op.create_index('ix_datasets_source_id', 'datasets', ['source_id'], unique=False)
    op.create_index('ix_datasets_title', 'datasets', ['title'], unique=False)

    op.create_table(
        'decisions',
        sa.Column('title', sa.String(length=1000), nullable=False),
        sa.Column('org', sa.String(length=300), nullable=True),
        sa.Column('decision_type', sa.String(length=100), nullable=True),
        sa.Column('date', sa.String(length=40), nullable=True),
        sa.Column('url', sa.String(length=500), nullable=True),
        sa.Column('project_id', sa.String(length=32), nullable=True),
        sa.Column('extra', sa.JSON(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_decisions_date', 'decisions', ['date'], unique=False)
    op.create_index('ix_decisions_org', 'decisions', ['org'], unique=False)
    op.create_index('ix_decisions_project_id', 'decisions', ['project_id'], unique=False)
    op.create_index('ix_decisions_title', 'decisions', ['title'], unique=False)

    op.create_table(
        'documents',
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('doc_type', sa.String(length=50), nullable=True),
        sa.Column('source_url', sa.String(length=500), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        'experiments',
        sa.Column('project_id', sa.String(length=32), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('run_ids', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_experiments_project_id', 'experiments', ['project_id'], unique=False)

    op.create_table(
        'feature_flags',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_feature_flags_name', 'feature_flags', ['name'], unique=True)

    op.create_table(
        'impact_metrics',
        sa.Column('run_id', sa.String(length=32), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('label', sa.JSON(), nullable=True),
        sa.Column('baseline', sa.Float(), nullable=True),
        sa.Column('value', sa.Float(), nullable=True),
        sa.Column('delta', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(length=50), nullable=True),
        sa.Column('direction', sa.String(length=20), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_impact_metrics_run_id', 'impact_metrics', ['run_id'], unique=False)

    op.create_table(
        'model_registry',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('description', sa.JSON(), nullable=True),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_model_registry_name', 'model_registry', ['name'], unique=True)

    op.create_table(
        'policies',
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=True),
        sa.Column('area', sa.String(length=200), nullable=True),
        sa.Column('horizon', sa.String(length=100), nullable=True),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('assumptions', sa.JSON(), nullable=True),
        sa.Column('kpis', sa.JSON(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_policies_category', 'policies', ['category'], unique=False)
    op.create_index('ix_policies_title', 'policies', ['title'], unique=False)

    op.create_table(
        'policy_variants',
        sa.Column('policy_id', sa.String(length=32), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_policy_variants_policy_id', 'policy_variants', ['policy_id'], unique=False)

    op.create_table(
        'projects',
        sa.Column('name', sa.String(length=500), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('org', sa.String(length=300), nullable=True),
        sa.Column('budget', sa.Float(), nullable=True),
        sa.Column('url', sa.String(length=500), nullable=True),
        sa.Column('geometry', sa.JSON(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_projects_name', 'projects', ['name'], unique=False)
    op.create_index('ix_projects_status', 'projects', ['status'], unique=False)

    op.create_table(
        'proposals',
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('area', sa.String(length=200), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=True),
        sa.Column('consultation_id', sa.String(length=32), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_proposals_consultation_id', 'proposals', ['consultation_id'], unique=False)
    op.create_index('ix_proposals_status', 'proposals', ['status'], unique=False)
    op.create_index('ix_proposals_title', 'proposals', ['title'], unique=False)

    op.create_table(
        'research_projects',
        sa.Column('name', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_research_projects_name', 'research_projects', ['name'], unique=False)

    op.create_table(
        'settings',
        sa.Column('key', sa.String(length=120), nullable=False),
        sa.Column('value', sa.JSON(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_settings_key', 'settings', ['key'], unique=True)

    op.create_table(
        'simulation_runs',
        sa.Column('policy_id', sa.String(length=32), nullable=True),
        sa.Column('model_name', sa.String(length=100), nullable=False),
        sa.Column('model_version', sa.String(length=50), nullable=True),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('results', sa.JSON(), nullable=True),
        sa.Column('passport', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('seed', sa.Integer(), nullable=True),
        sa.Column('id', sa.String(length=32), primary_key=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_simulation_runs_model_name', 'simulation_runs', ['model_name'], unique=False)
    op.create_index('ix_simulation_runs_policy_id', 'simulation_runs', ['policy_id'], unique=False)
    op.create_index('ix_simulation_runs_status', 'simulation_runs', ['status'], unique=False)


def downgrade() -> None:
    op.drop_table('simulation_runs')
    op.drop_table('settings')
    op.drop_table('research_projects')
    op.drop_table('proposals')
    op.drop_table('projects')
    op.drop_table('policy_variants')
    op.drop_table('policies')
    op.drop_table('model_registry')
    op.drop_table('impact_metrics')
    op.drop_table('feature_flags')
    op.drop_table('experiments')
    op.drop_table('documents')
    op.drop_table('decisions')
    op.drop_table('datasets')
    op.drop_table('dataset_versions')
    op.drop_table('data_sources')
    op.drop_table('data_quality_reports')
    op.drop_table('consultations')
    op.drop_table('connectors')
    op.drop_table('comments')
    op.drop_table('city_features')
    op.drop_table('city_areas')
    op.drop_table('cities')
    op.drop_table('audit_logs')
    op.drop_table('api_registry')
