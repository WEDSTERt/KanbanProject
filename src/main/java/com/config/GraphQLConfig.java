package com.config;

import graphql.scalars.ExtendedScalars;
import org.springframework.context.annotation.Configuration;
import org.springframework.graphql.execution.RuntimeWiringConfigurer;
import graphql.schema.idl.RuntimeWiring;

@Configuration
public class GraphQLConfig implements RuntimeWiringConfigurer {

    @Override
    public void configure(RuntimeWiring.Builder builder) {
        builder
            .scalar(ExtendedScalars.GraphQLLong)
            .scalar(ExtendedScalars.DateTime)
            .build();
    }
}
