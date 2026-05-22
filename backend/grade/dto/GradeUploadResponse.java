package com.studhub.grade.dto;

public class GradeUploadResponse {
    private int processed;
    private int failed;
    private String message;

    public GradeUploadResponse() {}

    public GradeUploadResponse(int processed, int failed, String message) {
        this.processed = processed;
        this.failed = failed;
        this.message = message;
    }

    public int getProcessed() { return processed; }
    public void setProcessed(int processed) { this.processed = processed; }

    public int getFailed() { return failed; }
    public void setFailed(int failed) { this.failed = failed; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}