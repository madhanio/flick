import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';

void main() {
  testWidgets('Flick app loads main shell with Porcelain Light Theme header', (WidgetTester tester) async {
    await tester.pumpWidget(const FlickApp());
    await tester.pumpAndSettle();

    // Verify main app title is rendered
    expect(find.text('⚡ FLICK'), findsOneWidget);
    expect(find.text('PAIRED DEVICES'), findsOneWidget);
  });
}
