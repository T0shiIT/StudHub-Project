public class main {
    public static void main(String[] args) throws InterruptedException {
        System.out.println("Java Auth Service started. Waiting for developers...");
        
        // Этот цикл не дает программе завершиться, 
        // чтобы контейнер не перезапускался
        while (true) {
            Thread.sleep(10000); 
        }
    }
}