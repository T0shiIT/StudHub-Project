public enum Role {
    STUDENT(1),
    TEACHER(2),
    ADMIN(3);

    private final int code;

    Role(int code) { this.code = code; }

    public int getCode() { return code; }

    public static Role fromCode(int code) {
        return switch (code) {
            case 1 -> STUDENT;
            case 2 -> TEACHER;
            case 3 -> ADMIN;
            default -> STUDENT;
        };
    }
}