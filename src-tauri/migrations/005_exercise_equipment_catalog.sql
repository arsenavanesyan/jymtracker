-- Тип снаряда / зона каталога (расширяется миграциями или вручную в БД)
CREATE TABLE exercise_equipment_kinds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO exercise_equipment_kinds (name, sort_order) VALUES
  ('Кроссовер', 10),
  ('Гиря', 20),
  ('Свободные веса', 30),
  ('Тренажёр', 40);

ALTER TABLE exercises ADD COLUMN equipment_kind_id INTEGER REFERENCES exercise_equipment_kinds (id);
ALTER TABLE exercises ADD COLUMN catalog_technique TEXT;
ALTER TABLE exercises ADD COLUMN catalog_muscles_hint TEXT;

CREATE INDEX idx_exercises_equipment_kind ON exercises (equipment_kind_id);

-- Ниже: стартовый каталог (INSERT OR IGNORE — не затирает уже существующие имена)

-- ========== Кроссовер ==========
INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Сведение рук в кроссовере',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер'),
  'Между стойками, рукояти верхних блоков. Лёгкий наклон вперёд, сведите руки перед собой, контролируя амплитуду.',
  'Основные: большая и малая грудные. Второстепенные: передние дельты, передняя зубчатая.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Сведение рук в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер') AND bp.name = 'Грудь';
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Сведение рук в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер') AND bp.name = 'Плечи';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'грудь' FROM exercises e WHERE e.name = 'Сведение рук в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер');
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'передние дельты' FROM exercises e WHERE e.name = 'Сведение рук в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Вертикальная тяга в кроссовере (одна рука)',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер'),
  'D-рукоять на верхнем блоке. Тяните вниз к поясу, локоть вдоль корпуса.',
  'Основные: широчайшие (верх). Второстепенные: бицепс, задние дельты.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Вертикальная тяга в кроссовере (одна рука)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер') AND bp.name = 'Спина';
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Вертикальная тяга в кроссовере (одна рука)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер') AND bp.name = 'Руки';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'широчайшие' FROM exercises e WHERE e.name = 'Вертикальная тяга в кроссовере (одна рука)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер');
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'бицепс' FROM exercises e WHERE e.name = 'Вертикальная тяга в кроссовере (одна рука)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Горизонтальная тяга в кроссовере',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер'),
  'Рукоять на нижнем блоке, сидя лицом к станции, ноги на платформе. Тяга к животу, сведение лопаток.',
  'Основные: широчайшие (середина/низ), ромбовидные. Второстепенные: бицепс, задние дельты.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Горизонтальная тяга в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер') AND bp.name = 'Спина';
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Горизонтальная тяга в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер') AND bp.name = 'Руки';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'широчайшие' FROM exercises e WHERE e.name = 'Горизонтальная тяга в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер');
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'ромбовидные' FROM exercises e WHERE e.name = 'Горизонтальная тяга в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Разгибание рук на трицепс в кроссовере',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер'),
  'Канат на верхнем блоке, локти у корпуса, разгибание вниз.',
  'Основные: трицепс. Второстепенные: локтевая, предплечья.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Разгибание рук на трицепс в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер') AND bp.name = 'Руки';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'трицепс' FROM exercises e WHERE e.name = 'Разгибание рук на трицепс в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Сгибание рук на бицепс в кроссовере',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер'),
  'Прямая или EZ-рукоять на нижнем блоке, хват снизу, локти у корпуса.',
  'Основные: бицепс. Второстепенные: брахиалис, предплечья.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Сгибание рук на бицепс в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер') AND bp.name = 'Руки';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'бицепс' FROM exercises e WHERE e.name = 'Сгибание рук на бицепс в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Отведение ноги в кроссовере',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер'),
  'Манжета на нижнем блоке, боком к станции, корпус зафиксировать, отведение ноги в сторону.',
  'Основные: средняя и малая ягодичные. Второстепенные: кор, ТБШ.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Отведение ноги в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер') AND bp.name = 'Ноги';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'ягодичные' FROM exercises e WHERE e.name = 'Отведение ноги в кроссовере' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Кроссовер');

-- ========== Гиря ==========
INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Махи гирей (свинг)',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря'),
  'Ноги шире плеч, замах гири между ног, затем мощное разгибание бедра — гиря до уровня груди.',
  'Основные: ягодицы, бицепс бедра, разгибатели спины. Второстепенные: кор, плечевой пояс, предплечья.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Махи гирей (свинг)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря') AND bp.name = 'Ноги';
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Махи гирей (свинг)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря') AND bp.name = 'Пресс';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'ягодичные' FROM exercises e WHERE e.name = 'Махи гирей (свинг)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Рывок гири',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря'),
  'Из замаха — мощное разгибание бедра и тяга, гиря по дуге вверх, фиксация над головой.',
  'Ноги, спина, плечи; предплечья и трицепс; высокая вовлечённость всего тела.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Рывок гири' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря') AND bp.name = 'Другое';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'комплексное' FROM exercises e WHERE e.name = 'Рывок гири' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Жим гири стоя',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря'),
  'Гиря на плече, жим вверх с полным разгибанием, контролируемый возврат.',
  'Основные: дельты (передний/средний), трицепс. Второстепенные: трапеции, кор.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Жим гири стоя' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря') AND bp.name = 'Плечи';
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Жим гири стоя' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря') AND bp.name = 'Руки';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'дельты' FROM exercises e WHERE e.name = 'Жим гири стоя' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря');
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'трицепс' FROM exercises e WHERE e.name = 'Жим гири стоя' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Приседания с гирей (goblet)',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря'),
  'Гиря у груди двумя руками за «рога», присед с прямой спиной и контролем колен.',
  'Основные: квадрицепс, ягодицы. Второстепенные: бицепс бедра, кор.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Приседания с гирей (goblet)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря') AND bp.name = 'Ноги';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'квадрицепс' FROM exercises e WHERE e.name = 'Приседания с гирей (goblet)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря');
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'ягодичные' FROM exercises e WHERE e.name = 'Приседания с гирей (goblet)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Тяга гири в наклоне',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря'),
  'Наклон корпуса, тяга гири к поясу, сведение лопатки.',
  'Основные: широчайшие, бицепс. Второстепенные: задние дельты, кор.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Тяга гири в наклоне' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря') AND bp.name = 'Спина';
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Тяга гири в наклоне' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря') AND bp.name = 'Руки';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'широчайшие' FROM exercises e WHERE e.name = 'Тяга гири в наклоне' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Турецкий подъём с гирей',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря'),
  'Сложное многоходовое движение: с пола к стойке с гирей над головой без потери контроля.',
  'Кор, плечи, ноги, ягодицы; комплексная нагрузка.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Турецкий подъём с гирей' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря') AND bp.name = 'Другое';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'комплексное' FROM exercises e WHERE e.name = 'Турецкий подъём с гирей' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Гиря');

-- ========== Свободные веса ==========
INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Приседания со штангой на плечах',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса'),
  'Штанга на трапециях, присед с контролем колен и нейтральной поясницей.',
  'Основные: квадрицепс, ягодицы. Второстепенные: бицепс бедра, разгибатели спины, кор.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Приседания со штангой на плечах' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса') AND bp.name = 'Ноги';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'квадрицепс' FROM exercises e WHERE e.name = 'Приседания со штангой на плечах' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Становая тяга',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса'),
  'Гриф у середины стопы, хват и вес на пятках/середине стопы, выпрямление с прямой спиной.',
  'Основные: разгибатели спины, ягодицы, бицепс бедра. Второстепенные: кор, трапеции, предплечья.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Становая тяга' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса') AND bp.name = 'Ноги';
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Становая тяга' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса') AND bp.name = 'Спина';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'ягодичные' FROM exercises e WHERE e.name = 'Становая тяга' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Жим штанги или гантелей лёжа',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса'),
  'На горизонтальной скамье — опускание к нижней груди и жим вверх.',
  'Основные: большая грудная. Второстепенные: трицепс, передние дельты.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Жим штанги или гантелей лёжа' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса') AND bp.name = 'Грудь';
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Жим штанги или гантелей лёжа' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса') AND bp.name = 'Руки';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'грудь' FROM exercises e WHERE e.name = 'Жим штанги или гантелей лёжа' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Тяга штанги или гантели в наклоне',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса'),
  'Наклон, тяга к поясу/нижней груди, сведение лопаток.',
  'Основные: широчайшие, ромбовидные. Второстепенные: бицепс, задние дельты, разгибатели спины.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Тяга штанги или гантели в наклоне' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса') AND bp.name = 'Спина';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'широчайшие' FROM exercises e WHERE e.name = 'Тяга штанги или гантели в наклоне' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Жим штанги или гантелей стоя (армейский жим)',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса'),
  'Штанга у груди или гантели у плеч — строгий жим вверх.',
  'Основные: дельты (передний/средний). Второстепенные: трицепс, трапеции, кор.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Жим штанги или гантелей стоя (армейский жим)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса') AND bp.name = 'Плечи';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'дельты' FROM exercises e WHERE e.name = 'Жим штанги или гантелей стоя (армейский жим)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Сгибание рук со штангой или гантелями',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса'),
  'Хват снизу или нейтральный, сгибание без «раскачки» корпуса.',
  'Основные: бицепс. Второстепенные: брахиалис, предплечья.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Сгибание рук со штангой или гантелями' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса') AND bp.name = 'Руки';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'бицепс' FROM exercises e WHERE e.name = 'Сгибание рук со штангой или гантелями' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Свободные веса');

-- ========== Тренажёр ==========
INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Жим ногами',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр'),
  'В тренажёре жима ногами — контролируемый амплитудный жим платформы.',
  'Основные: квадрицепс. Второстепенные: бицепс бедра, ягодицы.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Жим ногами' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр') AND bp.name = 'Ноги';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'квадрицепс' FROM exercises e WHERE e.name = 'Жим ногами' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Сгибание ног лёжа в тренажёре',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр'),
  'Пятки под валиками, сгибание к ягодицам.',
  'Основные: бицепс бедра. Второстепенные: икры.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Сгибание ног лёжа в тренажёре' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр') AND bp.name = 'Ноги';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'бицепс бедра' FROM exercises e WHERE e.name = 'Сгибание ног лёжа в тренажёре' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Разгибание ног сидя в тренажёре',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр'),
  'Голени за валиками, изолированное разгибание в коленях.',
  'Основные: квадрицепс.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Разгибание ног сидя в тренажёре' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр') AND bp.name = 'Ноги';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'квадрицепс' FROM exercises e WHERE e.name = 'Разгибание ног сидя в тренажёре' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Тяга верхнего блока к груди',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр'),
  'Широкий хват, тяга к верхней груди, сведение лопаток.',
  'Основные: широчайшие, ромбовидные. Второстепенные: бицепс, задние дельты.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Тяга верхнего блока к груди' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр') AND bp.name = 'Спина';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'широчайшие' FROM exercises e WHERE e.name = 'Тяга верхнего блока к груди' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Тяга нижнего блока к поясу',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр'),
  'Ноги на платформе, V-рукоять к низу живота, лопатки к позвоночнику.',
  'Основные: широчайшие (середина/низ), ромбовидные. Второстепенные: бицепс, задние дельты.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Тяга нижнего блока к поясу' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр') AND bp.name = 'Спина';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'широчайшие' FROM exercises e WHERE e.name = 'Тяга нижнего блока к поясу' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр');

INSERT OR IGNORE INTO exercises (name, equipment_kind_id, catalog_technique, catalog_muscles_hint)
VALUES (
  'Сведение рук в тренажёре (бабочка)',
  (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр'),
  'Предплечья к подушкам, сведение перед собой.',
  'Основные: большая и малая грудные. Второстепенные: передние дельты.'
);
INSERT OR IGNORE INTO exercise_body_parts (exercise_id, body_part_id)
SELECT e.id, bp.id FROM exercises e, body_parts bp
WHERE e.name = 'Сведение рук в тренажёре (бабочка)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр') AND bp.name = 'Грудь';
INSERT OR IGNORE INTO exercise_muscle_tags (exercise_id, tag)
SELECT e.id, 'грудь' FROM exercises e WHERE e.name = 'Сведение рук в тренажёре (бабочка)' AND e.equipment_kind_id = (SELECT id FROM exercise_equipment_kinds WHERE name = 'Тренажёр');
