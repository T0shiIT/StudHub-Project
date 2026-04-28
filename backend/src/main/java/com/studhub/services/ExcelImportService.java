package com.studhub.service;

import com.studhub.grade.Grade;
import com.studhub.schedule.ScheduleEntry;
import com.studhub.user.User;
import com.studhub.user.UserRepository;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

@Service
public class ExcelImportService {

    private final GradeService gradeService;
    private final ScheduleService scheduleService;
    private final UserRepository userRepository;

    public ExcelImportService(GradeService gradeService,
                              ScheduleService scheduleService,
                              UserRepository userRepository) {
        this.gradeService = gradeService;
        this.scheduleService = scheduleService;
        this.userRepository = userRepository;
    }

    public void importFile(MultipartFile file) throws Exception {
        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            Iterator<Row> rowIterator = sheet.iterator();
            if (!rowIterator.hasNext()) return;

            // Определяем тип данных по заголовкам
            Row headerRow = rowIterator.next();
            List<String> headers = new ArrayList<>();
            for (Cell cell : headerRow) {
                headers.add(cell.getStringCellValue().toLowerCase().trim());
            }

            if (headers.contains("оценка") || headers.contains("grade")) {
                List<Grade> grades = new ArrayList<>();
                while (rowIterator.hasNext()) {
                    Row row = rowIterator.next();
                    String email = getCellString(row, getIndex(headers, "email"));
                    User student = userRepository.findByEmail(email).orElse(null);
                    if (student == null) continue;

                    Grade g = new Grade();
                    g.setStudent(student);
                    g.setSubject(getCellString(row, getIndex(headers, "предмет")));
                    g.setGrade((int) row.getCell(getIndex(headers, "оценка")).getNumericCellValue());
                    g.setDate(LocalDate.parse(getCellString(row, getIndex(headers, "дата"))));
                    g.setTeacherName(getCellString(row, getIndex(headers, "преподаватель")));
                    grades.add(g);
                }
                gradeService.saveAll(grades);
            } else if (headers.contains("время начала") || headers.contains("starttime")) {
                List<ScheduleEntry> entries = new ArrayList<>();
                while (rowIterator.hasNext()) {
                    Row row = rowIterator.next();
                    ScheduleEntry e = new ScheduleEntry();
                    e.setGroupName(getCellString(row, getIndex(headers, "группа")));
                    e.setDate(LocalDate.parse(getCellString(row, getIndex(headers, "дата"))));
                    e.setStartTime(LocalTime.parse(getCellString(row, getIndex(headers, "время начала"))));
                    e.setEndTime(LocalTime.parse(getCellString(row, getIndex(headers, "время окончания"))));
                    e.setSubject(getCellString(row, getIndex(headers, "предмет")));
                    e.setRoom(getCellString(row, getIndex(headers, "аудитория")));
                    e.setTeacherName(getCellString(row, getIndex(headers, "преподаватель")));
                    entries.add(e);
                }
                scheduleService.saveAll(entries);
            } else {
                throw new IllegalArgumentException("Неизвестный формат Excel-файла");
            }
        }
    }

    private int getIndex(List<String> headers, String key) {
        return headers.indexOf(key);
    }

    private String getCellString(Row row, int col) {
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return "";
        cell.setCellType(CellType.STRING);
        return cell.getStringCellValue();
    }
}