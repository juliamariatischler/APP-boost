package at.boostschule;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class PermissionsRationaleActivity extends AppCompatActivity {

    private static final String PRIVACY_POLICY_URL = "https://boostschule.at/datenschutz";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_permissions_rationale);

        Button btnClose = findViewById(R.id.btn_understood);
        btnClose.setOnClickListener(v -> finish());

        TextView linkPrivacy = findViewById(R.id.link_privacy_policy);
        linkPrivacy.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(PRIVACY_POLICY_URL));
            startActivity(intent);
        });
    }
}
