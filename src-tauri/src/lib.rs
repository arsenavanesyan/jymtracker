use tauri_plugin_sql::{Builder, Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    const DB: &str = "sqlite:jymtracker.db";

    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema_and_seed",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "body_measurements",
            sql: include_str!("../migrations/002_body_measurements.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "exercise_muscle_tags",
            sql: include_str!("../migrations/003_exercise_muscle_tags.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "workout_survey_cardio",
            sql: include_str!("../migrations/004_workout_survey_cardio.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "exercise_equipment_catalog",
            sql: include_str!("../migrations/005_exercise_equipment_catalog.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            Builder::default()
                .add_migrations(DB, migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
